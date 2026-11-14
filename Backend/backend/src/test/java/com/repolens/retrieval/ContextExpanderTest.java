package com.repolens.retrieval;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class ContextExpanderTest {

    private static RetrievedChunk chunk(String path, String content) {
        return new RetrievedChunk(path + content.hashCode(), path, 1, 10, null, null, content, 0, null, null);
    }

    @Test
    void diversifyCapsChunksPerFileButFillsLeftoverSlots() {
        List<RetrievedChunk> ranked = List.of(
                chunk("A.java", "1"),
                chunk("A.java", "2"),
                chunk("A.java", "3"),
                chunk("A.java", "4"),
                chunk("B.java", "5"),
                chunk("C.java", "6"));
        List<RetrievedChunk> picked = ContextExpander.diversify(ranked, 5, 2);
        assertEquals(
                List.of("A.java", "A.java", "B.java", "C.java", "A.java"),
                picked.stream().map(RetrievedChunk::filePath).toList());
    }

    @Test
    void followsTypesAndImportsToOtherProjectFiles() {
        List<String> files = List.of(
                "src/auth/AuthController.java",
                "src/auth/AuthService.java",
                "src/auth/JwtService.java",
                "app/utils/dates.py",
                "web/src/api/client.ts",
                "web/src/index.ts",
                "web/a/index.ts",
                "web/b/index.ts",
                "web/c/index.ts",
                "web/d/index.ts");
        List<RetrievedChunk> chunks = List.of(
                chunk("src/auth/AuthController.java", "class AuthController { AuthService auth; JwtService jwt; }"),
                chunk("src/auth/AuthController.java", "auth.login(AuthService.normalize(email));"),
                chunk("app/views.py", "from app.utils.dates import parse\nimport os"),
                chunk("web/src/Login.tsx", "import { api } from './api/client';\nimport x from './index';"));
        List<String> refs = ContextExpander.referencedFiles(chunks, files, 4);
        assertEquals("src/auth/AuthService.java", refs.get(0), "referenced by two chunks → first");
        assertTrue(refs.contains("src/auth/JwtService.java"));
        assertTrue(refs.contains("app/utils/dates.py"));
        assertTrue(refs.contains("web/src/api/client.ts"));
        assertFalse(refs.contains("src/auth/AuthController.java"), "already in context");
        assertTrue(refs.stream().noneMatch(r -> r.endsWith("index.ts")), "ambiguous names are skipped");
    }

    @Test
    void broadQuestions() {
        assertTrue(ContextExpander.isBroad("List all REST endpoints"));
        assertTrue(ContextExpander.isBroad("Which API endpoints exist?"));
        assertTrue(ContextExpander.isBroad("How does this app work end to end?"));
        assertTrue(ContextExpander.isBroad("Give me an overview of the architecture"));
        assertFalse(ContextExpander.isBroad("Where is the JWT validated?"));
    }
}
