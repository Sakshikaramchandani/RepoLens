package com.repolens.ai;

import com.repolens.project.ProjectService;
import com.repolens.retrieval.HybridRetriever;
import com.repolens.retrieval.QueryTokenizer;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Debug endpoints for tuning retrieval and prompts. Only exist when DEV_TOOLS_ENABLED=true:
 * they run the models on demand, so they must not be reachable in production.
 */
@RestController
@RequestMapping("/api/ai")
@Tag(name = "AI diagnostics (dev only)")
@ConditionalOnProperty(name = "app.dev-tools.enabled", havingValue = "true")
public class AiDiagnosticsController {

    private final LlmRouter llmRouter;
    private final EmbeddingModel embeddingModel;
    private final ProjectService projectService;
    private final HybridRetriever hybridRetriever;

    public AiDiagnosticsController(
            LlmRouter llmRouter,
            EmbeddingModel embeddingModel,
            ProjectService projectService,
            HybridRetriever hybridRetriever) {
        this.llmRouter = llmRouter;
        this.embeddingModel = embeddingModel;
        this.projectService = projectService;
        this.hybridRetriever = hybridRetriever;
    }

    @GetMapping("/test-embedding")
    @Operation(summary = "Text -> embedding. Expect 768 dimensions")
    public Map<String, Object> testEmbedding(@RequestParam String text) {
        float[] vector = embeddingModel.embed(text);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dimensions", vector.length);
        result.put("first5", Arrays.copyOf(vector, Math.min(5, vector.length)));
        return result;
    }

    @GetMapping("/test-chat")
    @Operation(summary = "One-off prompt to the chat model")
    public Map<String, Object> testChat(@RequestParam String message) {
        LlmRouter.LlmResult result = llmRouter
                .complete(LlmPrompt.of("You are a concise assistant.", message).withMaxTokens(300))
                .block();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("provider", result.provider());
        body.put("model", result.model());
        body.put("answer", result.text());
        return body;
    }

    @GetMapping("/test-retrieval")
    @Operation(summary = "Hybrid retrieval debug: vector rank, keyword rank, RRF score")
    public Map<String, Object> testRetrieval(
            @RequestParam Long projectId, @RequestParam String q, @AuthenticationPrincipal User user) {
        projectService.getOwnedProject(projectId, user.getId());

        List<Map<String, Object>> rows = hybridRetriever.retrieve(projectId, q).stream()
                .map(c -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("citation", c.citation());
                    row.put("filePath", c.filePath());
                    row.put("method", c.methodName());
                    row.put("rrfScore", Math.round(c.score() * 10000) / 10000.0);
                    row.put("vectorRank", c.vectorRank());
                    row.put("keywordRank", c.keywordRank());
                    return row;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("keywords", QueryTokenizer.tokens(q));
        result.put("results", rows);
        return result;
    }
}
