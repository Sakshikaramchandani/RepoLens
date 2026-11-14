package com.repolens.chunking;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.indexing.ChunkType;
import com.repolens.indexing.CodeChunk;
import java.util.List;
import org.junit.jupiter.api.Test;

class StructureChunkerTest {

    private final AstCodeChunker chunker = new AstCodeChunker();

    @Test
    void pythonGetsOneChunkPerFunctionWithClassNames() {
        String code = """
                import os
                import sys


                class Billing:
                    def charge(self, user, amount):
                        if amount <= 0:
                            raise ValueError("amount")
                        total = amount * 1.18
                        self.gateway.pay(user, total)
                        self.audit.log(user, total)
                        return total

                    def refund(self, payment):
                        if payment.refunded:
                            return False
                        self.gateway.refund(payment)
                        payment.refunded = True
                        self.audit.log(payment.user, -payment.total)
                        return True
                """;
        List<CodeChunk> chunks = chunker.chunk(7L, "app/billing.py", code);
        CodeChunk refund = chunks.stream()
                .filter(c -> "refund".equals(c.methodName()))
                .findFirst()
                .orElseThrow();
        assertEquals(ChunkType.METHOD, refund.type());
        assertEquals("Billing", refund.className());
        assertTrue(refund.content().startsWith("    def refund"));
        assertTrue(chunks.stream().anyMatch(c -> "charge".equals(c.methodName())));
        // nothing is lost: chunks cover the file
        assertEquals(1, chunks.get(0).startLine());
        assertEquals(code.split("\n").length, chunks.get(chunks.size() - 1).endLine());
    }

    @Test
    void longFunctionsAreSplitWithOverlapAndConfigFilesByWindow() {
        StringBuilder go = new StringBuilder("package main\n\nfunc Big() {\n");
        for (int i = 0; i < 200; i++) {
            go.append("    x").append(i).append(" := ").append(i).append("\n");
        }
        go.append("}\n");
        List<CodeChunk> chunks = chunker.chunk(1L, "main.go", go.toString());
        assertTrue(chunks.size() >= 3);
        assertTrue(chunks.stream().allMatch(c -> c.endLine() - c.startLine() < 80));
        assertEquals(1, chunks.get(0).startLine(), "the tiny package header joins the function");
        assertTrue(chunks.get(1).startLine() < chunks.get(0).endLine(), "overlap between windows");

        List<CodeChunk> yaml = chunker.chunk(1L, "docker-compose.yml", "services:\n  db:\n    image: postgres\n");
        assertEquals(1, yaml.size());
        assertEquals(ChunkType.FILE, yaml.get(0).type());
    }

    @Test
    void testFilesAndStableIds() {
        assertTrue(
                chunker.chunk(1L, "web/src/App.test.tsx", "it('x', () => {})").isEmpty());
        String ts = "export function a() {\n  return 1;\n}\n";
        assertEquals(
                chunker.chunk(1L, "src/a.ts", ts).get(0).id(),
                chunker.chunk(1L, "src/a.ts", ts).get(0).id());
    }
}
