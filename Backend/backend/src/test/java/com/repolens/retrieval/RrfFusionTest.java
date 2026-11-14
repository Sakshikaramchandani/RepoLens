package com.repolens.retrieval;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class RrfFusionTest {

    private static RetrievedChunk chunk(String id) {
        return new RetrievedChunk(id, "src/" + id + ".java", 1, 10, null, null, "code", 0, null, null);
    }

    @Test
    void chunkInBothListsComesFirst() {
        List<RetrievedChunk> vector = List.of(chunk("a"), chunk("b"), chunk("c"));
        List<RetrievedChunk> keyword = List.of(chunk("c"), chunk("d"), chunk("a"));

        List<RetrievedChunk> fused = RrfFusion.fuse(vector, keyword, 60, 10);

        // a aur c dono lists mein hain, isliye upar. b aur d sirf ek mein
        assertEquals(
                List.of("a", "c"),
                fused.subList(0, 2).stream().map(RetrievedChunk::id).toList());
        assertEquals(4, fused.size());
        assertEquals(1, fused.get(0).vectorRank());
        assertEquals(3, fused.get(0).keywordRank());
    }

    @Test
    void scoreFollowsFormula() {
        List<RetrievedChunk> fused = RrfFusion.fuse(List.of(chunk("a")), List.of(chunk("a")), 60, 10);
        assertEquals(2.0 / 61, fused.get(0).score(), 1e-9); // 1/(60+1) + 1/(60+1)
    }

    @Test
    void respectsLimitAndEmptyLists() {
        assertEquals(
                1,
                RrfFusion.fuse(List.of(chunk("a"), chunk("b")), List.of(), 60, 1)
                        .size());
        assertTrue(RrfFusion.fuse(List.of(), List.of(), 60, 5).isEmpty());
    }

    @Test
    void citationFormat() {
        RetrievedChunk c = new RetrievedChunk(
                "x", "src/main/java/com/demo/AuthService.java", 42, 60, null, null, "", 0, null, null);
        assertEquals("AuthService.java:42-60", c.citation());
    }
}
