package com.repolens.ai;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import reactor.core.publisher.Flux;

class LlmRouterTest {

    private static final LlmPrompt PROMPT = LlmPrompt.of("sys", "question");

    private static LlmClient client(Flux<String> answer) {
        LlmClient c = Mockito.mock(LlmClient.class);
        Mockito.when(c.provider()).thenReturn("ollama");
        Mockito.when(c.model()).thenReturn("qwen2.5-coder:7b");
        Mockito.when(c.stream(Mockito.any())).thenReturn(answer);
        Mockito.when(c.complete(Mockito.any())).thenReturn(answer.collectList().map(l -> String.join("", l)));
        return c;
    }

    @Test
    void streamTagsEveryChunkWithTheModel() {
        LlmRouter router = new LlmRouter(client(Flux.just("a", "b")));

        List<LlmRouter.LlmChunk> chunks = router.stream(PROMPT).collectList().block();

        assertEquals(2, chunks.size());
        assertEquals("qwen2.5-coder:7b", chunks.get(0).model());
        assertEquals("ollama", chunks.get(1).provider());
    }

    @Test
    void completeReturnsWholeAnswer() {
        LlmRouter router = new LlmRouter(client(Flux.just("hello ", "world")));

        LlmRouter.LlmResult result = router.complete(PROMPT).block();

        assertEquals("hello world", result.text());
        assertEquals("qwen2.5-coder:7b", result.model());
    }

    @Test
    void llmExceptionsPassThroughUnchanged() {
        LlmRouter router = new LlmRouter(client(Flux.error(new LlmException("Could not reach Ollama", true))));

        LlmException e =
                assertThrows(LlmException.class, () -> router.stream(PROMPT).blockLast());
        assertEquals("Could not reach Ollama", e.getMessage());
        assertTrue(e.isRetryable());
    }

    @Test
    void unexpectedErrorsBecomeLlmExceptions() {
        LlmRouter router = new LlmRouter(client(Flux.error(new IllegalStateException("boom"))));

        LlmException e =
                assertThrows(LlmException.class, () -> router.complete(PROMPT).block());
        assertFalse(e.getMessage().contains("boom"));
    }

    @Test
    void reportsTheModelInUse() {
        LlmRouter router = new LlmRouter(client(Flux.empty()));
        assertEquals("qwen2.5-coder:7b", router.provider().model());
    }
}
