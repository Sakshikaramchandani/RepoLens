package com.repolens.chat;

import com.repolens.ai.LlmException;
import com.repolens.ai.LlmPrompt;
import com.repolens.ai.LlmRouter;
import com.repolens.chat.ChatDtos.ChatRequest;
import com.repolens.chat.ChatDtos.ChatStreamEvent;
import com.repolens.chat.ChatDtos.SourceRef;
import com.repolens.common.ApiException;
import com.repolens.indexing.ChunkStore;
import com.repolens.project.ProjectService;
import com.repolens.retrieval.HybridRetriever;
import com.repolens.retrieval.ProjectIndex;
import com.repolens.retrieval.RetrievedChunk;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * RAG flow:
 * 1. Validate + ownership + project is indexed
 * 2. Conversation: new / continue (save the question) or regenerate (drop the last answer)
 * 3. Hybrid retrieval (vector + keyword + RRF); short follow-ups also use the previous question
 * 4. Prompt (system rules + delimited chunks + history + question)
 * 5. LlmRouter stream (local Ollama) -> one SSE "token" event per piece
 * 6. End: save answer (with model name) -> "sources" -> "done"
 * Any error: "error" -> "done" (the stream never hangs halfway)
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    static final int MAX_QUESTION_CHARS = 2000;
    /** Follow-ups shorter than this ("and its tests?") borrow the previous question for retrieval. */
    private static final int SHORT_FOLLOW_UP_CHARS = 80;

    private final ProjectService projectService;
    private final ChunkStore chunkStore;
    private final ConversationService conversationService;
    private final HybridRetriever retriever;
    private final ProjectIndex projectIndex;
    private final PromptBuilder promptBuilder;
    private final LlmRouter llmRouter;
    private final int historyMessages;

    public ChatService(
            ProjectService projectService,
            ChunkStore chunkStore,
            ConversationService conversationService,
            HybridRetriever retriever,
            ProjectIndex projectIndex,
            PromptBuilder promptBuilder,
            LlmRouter llmRouter,
            @Value("${app.chat.history-messages}") int historyMessages) {
        this.projectService = projectService;
        this.chunkStore = chunkStore;
        this.conversationService = conversationService;
        this.retriever = retriever;
        this.projectIndex = projectIndex;
        this.promptBuilder = promptBuilder;
        this.llmRouter = llmRouter;
        this.historyMessages = historyMessages;
    }

    private record Prepared(Long conversationId, PromptBuilder.PromptParts parts) {}

    public Flux<ChatStreamEvent> chat(ChatRequest request, Long userId) {
        Prepared prepared;
        try {
            prepared = prepare(request, userId);
        } catch (ApiException e) {
            return Flux.just(error(e.getMessage()), done(request == null ? null : request.conversationId(), null));
        } catch (RuntimeException e) {
            log.error("Chat preparation failed", e);
            return Flux.just(error("Something went wrong while preparing the answer"), done(null, null));
        }

        Long conversationId = prepared.conversationId();

        // Nothing relevant found: no need to call a model
        if (prepared.parts().usedChunks().isEmpty()) {
            conversationService.saveAssistantMessage(conversationId, PromptBuilder.NOT_FOUND_ANSWER, List.of(), null);
            return Flux.just(token(PromptBuilder.NOT_FOUND_ANSWER), sources(List.of()), done(conversationId, null));
        }
        return stream(prepared);
    }

    private Prepared prepare(ChatRequest request, Long userId) {
        if (request == null || request.projectId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "projectId is required");
        }
        projectService.getOwnedProject(request.projectId(), userId);
        if (chunkStore.countByProject(request.projectId()) == 0) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "This project is not indexed yet. Index it first, then ask again");
        }

        Long conversationId;
        String question;
        List<ChatMessage> history;

        if (request.isRegenerate()) {
            if (request.conversationId() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "conversationId is required to regenerate");
            }
            conversationId = conversationService
                    .requireOwned(request.conversationId(), request.projectId(), userId)
                    .getId();
            ConversationService.Rewind rewind =
                    conversationService.rewindToLastQuestion(conversationId, historyMessages);
            question = rewind.question();
            history = rewind.history();
        } else {
            question = validQuestion(request.message());
            conversationId = conversationService
                    .startOrContinue(request.conversationId(), request.projectId(), userId, question)
                    .getId();
            // History FIRST, then save the new question (otherwise it would appear twice)
            history = conversationService.recentMessages(conversationId, historyMessages);
            conversationService.saveUserMessage(conversationId, question);
        }

        List<String> projectFiles = projectIndex.files(request.projectId());
        List<RetrievedChunk> chunks =
                retriever.retrieve(request.projectId(), retrievalQuery(question, history), projectFiles);
        return new Prepared(conversationId, promptBuilder.build(question, chunks, history, projectFiles));
    }

    private static String validQuestion(String message) {
        if (message == null || message.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Message is required");
        }
        String question = message.trim();
        if (question.length() > MAX_QUESTION_CHARS) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Message is too long (max " + MAX_QUESTION_CHARS + " characters)");
        }
        return question;
    }

    /** "What about its tests?" alone retrieves nothing useful; with the previous question it does. */
    static String retrievalQuery(String question, List<ChatMessage> history) {
        if (question.length() >= SHORT_FOLLOW_UP_CHARS) {
            return question;
        }
        for (int i = history.size() - 1; i >= 0; i--) {
            ChatMessage m = history.get(i);
            if (m.getRole() == MessageRole.USER) {
                return m.getContent() + "\n" + question;
            }
        }
        return question;
    }

    private Flux<ChatStreamEvent> stream(Prepared prepared) {
        Long conversationId = prepared.conversationId();
        List<SourceRef> sourceRefs = toSources(prepared.parts().usedChunks());
        StringBuilder answer = new StringBuilder();
        AtomicReference<String> model = new AtomicReference<>();
        AtomicBoolean saved = new AtomicBoolean(false);

        // Save exactly once — on completion, error or cancel. Empty answers are not saved, so the
        // question stays "unanswered" and can be regenerated.
        Runnable saveAnswer = () -> {
            if (saved.compareAndSet(false, true) && !answer.isEmpty()) {
                conversationService.saveAssistantMessage(conversationId, answer.toString(), sourceRefs, model.get());
            }
        };

        LlmPrompt prompt =
                LlmPrompt.of(PromptBuilder.SYSTEM_PROMPT, prepared.parts().userPrompt());

        Flux<ChatStreamEvent> tokens = llmRouter.stream(prompt)
                .doOnNext(chunk -> {
                    model.compareAndSet(null, label(chunk));
                    answer.append(chunk.text());
                })
                .map(chunk -> token(chunk.text()));

        // DB writes block, so they run on boundedElastic
        Flux<ChatStreamEvent> ending = Mono.fromRunnable(saveAnswer)
                .subscribeOn(Schedulers.boundedElastic())
                .thenMany(Flux.defer(() -> Flux.just(sources(sourceRefs), done(conversationId, model.get()))));

        return tokens.concatWith(ending)
                .onErrorResume(e -> {
                    String message =
                            e instanceof LlmException llm ? llm.userMessage() : "The AI model failed to answer";
                    log.warn("Chat stream failed (conversation {}): {}", conversationId, e.getMessage());
                    return Mono.fromRunnable(saveAnswer)
                            .subscribeOn(Schedulers.boundedElastic())
                            .thenMany(Flux.defer(() -> Flux.just(error(message), done(conversationId, model.get()))));
                })
                .doOnCancel(() -> Schedulers.boundedElastic().schedule(saveAnswer)); // tab closed / Stop
    }

    /** e.g. "qwen2.5-coder:7b". */
    private static String label(LlmRouter.LlmChunk chunk) {
        return chunk.model();
    }

    /** Same citation only once, in RRF order. */
    private static List<SourceRef> toSources(List<RetrievedChunk> chunks) {
        Map<String, SourceRef> unique = new LinkedHashMap<>();
        for (RetrievedChunk c : chunks) {
            String key = c.filePath() + ":" + c.startLine() + "-" + c.endLine();
            unique.putIfAbsent(key, new SourceRef(c.filePath(), c.startLine(), c.endLine()));
        }
        return List.copyOf(unique.values());
    }

    // ---------- SSE events ----------

    private static ChatStreamEvent token(String text) {
        return new ChatStreamEvent("token", text, null, null, null);
    }

    private static ChatStreamEvent sources(List<SourceRef> sources) {
        return new ChatStreamEvent("sources", null, sources, null, null);
    }

    private static ChatStreamEvent done(Long conversationId, String model) {
        return new ChatStreamEvent("done", null, null, conversationId, model);
    }

    private static ChatStreamEvent error(String message) {
        return new ChatStreamEvent("error", message, null, null, null);
    }
}
