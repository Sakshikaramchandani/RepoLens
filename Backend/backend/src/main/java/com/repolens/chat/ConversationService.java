package com.repolens.chat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repolens.chat.ChatDtos.ConversationSummary;
import com.repolens.chat.ChatDtos.MessageResponse;
import com.repolens.chat.ChatDtos.SourceRef;
import com.repolens.common.ApiException;
import com.repolens.project.ProjectService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Conversations + messages. Every public method checks that the conversation belongs to the user. */
@Service
public class ConversationService {

    private static final TypeReference<List<SourceRef>> SOURCES_TYPE = new TypeReference<>() {};
    private static final int TITLE_MAX = 60;
    private static final int SEARCH_MAX = 100;

    /** What a regenerate needs: the question to answer again and the messages before it. */
    public record Rewind(String question, List<ChatMessage> history) {}

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ProjectService projectService;
    private final ObjectMapper objectMapper;

    public ConversationService(
            ConversationRepository conversationRepository,
            ChatMessageRepository messageRepository,
            ProjectService projectService,
            ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.projectService = projectService;
        this.objectMapper = objectMapper;
    }

    /** conversationId null = new conversation (title = first question). Otherwise an owned one of this project. */
    @Transactional
    public Conversation startOrContinue(Long conversationId, Long projectId, Long userId, String question) {
        if (conversationId == null) {
            return conversationRepository.save(new Conversation(projectId, userId, makeTitle(question)));
        }
        return requireOwned(conversationId, projectId, userId);
    }

    @Transactional(readOnly = true)
    public Conversation requireOwned(Long conversationId, Long projectId, Long userId) {
        return conversationRepository
                .findByIdAndUserId(conversationId, userId)
                .filter(c -> projectId == null || c.getProjectId().equals(projectId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Conversation not found"));
    }

    /** Latest N messages, oldest first. */
    @Transactional(readOnly = true)
    public List<ChatMessage> recentMessages(Long conversationId, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        List<ChatMessage> latest = new ArrayList<>(
                messageRepository.findByConversationIdOrderByIdDesc(conversationId, PageRequest.of(0, limit)));
        Collections.reverse(latest);
        return latest;
    }

    /**
     * Regenerate: find the last user question, delete every answer after it, and return the
     * question plus up to {@code historyLimit} earlier messages.
     */
    @Transactional
    public Rewind rewindToLastQuestion(Long conversationId, int historyLimit) {
        List<ChatMessage> all = messageRepository.findByConversationIdOrderByIdAsc(conversationId);
        int last = -1;
        for (int i = all.size() - 1; i >= 0; i--) {
            if (all.get(i).getRole() == MessageRole.USER) {
                last = i;
                break;
            }
        }
        if (last < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "There is no question to regenerate");
        }
        messageRepository.deleteAll(all.subList(last + 1, all.size()));
        List<ChatMessage> history = List.copyOf(all.subList(Math.max(0, last - historyLimit), last));
        return new Rewind(all.get(last).getContent(), history);
    }

    @Transactional
    public void saveUserMessage(Long conversationId, String content) {
        save(conversationId, MessageRole.USER, content, null, null);
    }

    @Transactional
    public void saveAssistantMessage(Long conversationId, String content, List<SourceRef> sources, String model) {
        save(conversationId, MessageRole.ASSISTANT, content, toJson(sources), model);
    }

    /** query blank = all conversations; otherwise title or message text contains it. Newest first. */
    @Transactional(readOnly = true)
    public List<ConversationSummary> list(Long projectId, Long userId, String query) {
        projectService.getOwnedProject(projectId, userId);
        List<Conversation> found = (query == null || query.isBlank())
                ? conversationRepository.findByProjectIdAndUserIdOrderByUpdatedAtDesc(projectId, userId)
                : conversationRepository.search(projectId, userId, likePattern(query));
        return found.stream()
                .limit(SEARCH_MAX)
                .map(ConversationService::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(Long conversationId, Long userId) {
        requireOwned(conversationId, null, userId);
        return messageRepository.findByConversationIdOrderByIdAsc(conversationId).stream()
                .map(m -> new MessageResponse(
                        m.getId(),
                        m.getRole().name(),
                        m.getContent(),
                        fromJson(m.getSourcesJson()),
                        m.getCreatedAt(),
                        m.getModel()))
                .toList();
    }

    @Transactional
    public ConversationSummary rename(Long conversationId, Long userId, String title) {
        Conversation conversation = requireOwned(conversationId, null, userId);
        String clean = title == null ? "" : title.replaceAll("\\s+", " ").trim();
        if (clean.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Title is required");
        }
        conversation.rename(clean);
        return toSummary(conversationRepository.save(conversation));
    }

    /** Messages go with it (ON DELETE CASCADE in V5). */
    @Transactional
    public void delete(Long conversationId, Long userId) {
        conversationRepository.delete(requireOwned(conversationId, null, userId));
    }

    // ------------------------------------------------------------------------------------------

    private void save(Long conversationId, MessageRole role, String content, String sourcesJson, String model) {
        messageRepository.save(new ChatMessage(conversationId, role, content, sourcesJson, model));
        conversationRepository.findById(conversationId).ifPresent(Conversation::touch);
    }

    private static ConversationSummary toSummary(Conversation c) {
        return new ConversationSummary(c.getId(), c.getProjectId(), c.getTitle(), c.getCreatedAt(), c.getUpdatedAt());
    }

    static String makeTitle(String question) {
        String t = question.replaceAll("\\s+", " ").trim();
        return t.length() <= TITLE_MAX ? t : t.substring(0, TITLE_MAX).trim() + "…";
    }

    /** "%50% off_" → "%\%50\% off\_%": the user's text is matched literally. */
    static String likePattern(String query) {
        String trimmed = query.trim();
        if (trimmed.length() > 100) {
            trimmed = trimmed.substring(0, 100);
        }
        String escaped = trimmed.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private String toJson(List<SourceRef> sources) {
        try {
            return objectMapper.writeValueAsString(sources == null ? List.of() : sources);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<SourceRef> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, SOURCES_TYPE);
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }
}
