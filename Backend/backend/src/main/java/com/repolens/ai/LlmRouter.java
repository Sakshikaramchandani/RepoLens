package com.repolens.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * The only entry point the rest of the app uses for the chat model (local Ollama, see {@link OllamaClient}).
 * Every chunk/result carries the provider and model that produced it.
 */
@Service
public class LlmRouter {

    private static final Logger log = LoggerFactory.getLogger(LlmRouter.class);

    /** One piece of answer text plus who produced it. */
    public record LlmChunk(String text, String provider, String model) {}

    /** A complete answer plus who produced it. */
    public record LlmResult(String text, String provider, String model) {}

    /** Snapshot for the status endpoint / settings page. */
    public record ProviderInfo(String provider, String model) {}

    private final LlmClient client;

    public LlmRouter(LlmClient client) {
        this.client = client;
        log.info("Chat model: {}/{}", client.provider(), client.model());
    }

    public Flux<LlmChunk> stream(LlmPrompt prompt) {
        return Flux.defer(() -> client.stream(prompt))
                .map(text -> new LlmChunk(text, client.provider(), client.model()))
                .onErrorMap(this::wrap);
    }

    public Mono<LlmResult> complete(LlmPrompt prompt) {
        return Mono.defer(() -> client.complete(prompt))
                .map(text -> new LlmResult(text, client.provider(), client.model()))
                .onErrorMap(this::wrap);
    }

    public ProviderInfo provider() {
        return new ProviderInfo(client.provider(), client.model());
    }

    private Throwable wrap(Throwable error) {
        return error instanceof LlmException
                ? error
                : new LlmException(client.provider() + " failed unexpectedly", false, error);
    }
}
