package com.repolens.ai;

import java.util.List;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * Local Ollama chat model (Spring AI auto-configures it from spring.ai.ollama.chat.*).
 * Answers every chat and code-review request.
 */
@Component
public class OllamaClient implements LlmClient {

    public static final String PROVIDER = "ollama";

    private final ChatModel chatModel;
    private final String model;
    private final String baseUrl;

    public OllamaClient(
            ChatModel chatModel,
            @Value("${spring.ai.ollama.chat.options.model}") String model,
            @Value("${spring.ai.ollama.base-url}") String baseUrl) {
        this.chatModel = chatModel;
        this.model = model;
        this.baseUrl = baseUrl;
    }

    @Override
    public String provider() {
        return PROVIDER;
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public Flux<String> stream(LlmPrompt prompt) {
        // Messages are passed directly (no template), so { } in code is never read as a variable
        return chatModel.stream(toPrompt(prompt))
                .map(OllamaClient::textOf)
                .filter(text -> !text.isEmpty())
                .onErrorMap(this::friendly);
    }

    @Override
    public Mono<String> complete(LlmPrompt prompt) {
        return Mono.fromCallable(() -> textOf(chatModel.call(toPrompt(prompt))))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorMap(this::friendly);
    }

    private static Prompt toPrompt(LlmPrompt prompt) {
        return new Prompt(List.of(new SystemMessage(prompt.system()), new UserMessage(prompt.user())));
    }

    private static String textOf(ChatResponse response) {
        if (response == null
                || response.getResult() == null
                || response.getResult().getOutput() == null) {
            return "";
        }
        String text = response.getResult().getOutput().getText();
        return text == null ? "" : text;
    }

    private Throwable friendly(Throwable e) {
        if (e instanceof LlmException) {
            return e;
        }
        String msg = rootMessage(e);
        if (msg.contains("Connection refused") || msg.contains("connect")) {
            return new LlmException("Could not reach Ollama at " + baseUrl + ". Is Ollama running?", true, e);
        }
        if (msg.contains("not found")) {
            return new LlmException("Ollama model missing. Run: ollama pull " + model, false, e);
        }
        return new LlmException("Ollama error: " + (msg.length() > 200 ? msg.substring(0, 200) : msg), true, e);
    }

    private static String rootMessage(Throwable e) {
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return String.valueOf(root.getMessage());
    }
}
