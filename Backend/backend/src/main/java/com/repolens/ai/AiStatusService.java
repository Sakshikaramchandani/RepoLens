package com.repolens.ai;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

/**
 * Live view of the AI setup for the settings page. Reachability is probed with a cheap GET call
 * (Ollama /api/tags) and cached for 30 s so opening the page repeatedly costs nothing.
 */
@Service
public class AiStatusService {

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(4);
    private static final Duration CACHE_FOR = Duration.ofSeconds(30);

    public record ModelStatus(
            String role, String provider, String model, boolean configured, boolean reachable, String detail) {}

    public record AiStatus(List<ModelStatus> chat, ModelStatus embedding) {}

    private record Cached(AiStatus status, Instant at) {}

    private final LlmRouter router;
    private final WebClient webClient;
    private final String ollamaBaseUrl;
    private final String embeddingModel;
    private final AtomicReference<Cached> cache = new AtomicReference<>();

    public AiStatusService(
            LlmRouter router,
            WebClient.Builder builder,
            @Value("${spring.ai.ollama.base-url}") String ollamaBaseUrl,
            @Value("${spring.ai.ollama.embedding.options.model}") String embeddingModel) {
        this.router = router;
        this.webClient = builder.clone().build();
        this.ollamaBaseUrl = ollamaBaseUrl;
        this.embeddingModel = embeddingModel;
    }

    public AiStatus status() {
        Cached cached = cache.get();
        if (cached != null && cached.at().plus(CACHE_FOR).isAfter(Instant.now())) {
            return cached.status();
        }
        AiStatus fresh = probe();
        cache.set(new Cached(fresh, Instant.now()));
        return fresh;
    }

    private AiStatus probe() {
        List<String> ollamaModels = ollamaModels();
        boolean ollamaUp = ollamaModels != null;

        List<ModelStatus> chat =
                List.of(ollamaStatus("primary", router.provider().model(), ollamaUp, ollamaModels));
        ModelStatus embedding = ollamaStatus("embedding", embeddingModel, ollamaUp, ollamaModels);
        return new AiStatus(chat, embedding);
    }

    private ModelStatus ollamaStatus(String role, String model, boolean up, List<String> installed) {
        if (!up) {
            return new ModelStatus(
                    role, OllamaClient.PROVIDER, model, true, false, "Ollama is not reachable at " + ollamaBaseUrl);
        }
        boolean present = installed.stream().anyMatch(name -> name.equals(model) || name.equals(model + ":latest"));
        return new ModelStatus(
                role,
                OllamaClient.PROVIDER,
                model,
                true,
                present,
                present ? "Installed" : "Model not pulled. Run: ollama pull " + model);
    }

    /** Installed model names, or null if Ollama is down. */
    private List<String> ollamaModels() {
        try {
            JsonNode tags = webClient
                    .get()
                    .uri(ollamaBaseUrl + "/api/tags")
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .timeout(PROBE_TIMEOUT)
                    .onErrorResume(e -> Mono.empty())
                    .block();
            if (tags == null) {
                return null;
            }
            List<String> names = new ArrayList<>();
            tags.path("models").forEach(m -> names.add(m.path("name").asText()));
            return names;
        } catch (Exception e) {
            return null;
        }
    }
}
