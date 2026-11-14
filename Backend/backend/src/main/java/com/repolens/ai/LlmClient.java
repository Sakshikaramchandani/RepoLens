package com.repolens.ai;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** The chat-model provider. */
public interface LlmClient {

    /** Stable provider id, e.g. "ollama". */
    String provider();

    /** Model name sent to the provider, e.g. "qwen2.5-coder:7b". */
    String model();

    /** Streams the answer text piece by piece. Errors are {@link LlmException}s. */
    Flux<String> stream(LlmPrompt prompt);

    /** Full answer in one piece (used where streaming adds nothing, e.g. JSON code review). */
    Mono<String> complete(LlmPrompt prompt);
}
