package com.repolens.indexing;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Vector store ka saara kaam ek jagah.
 * vectorStore.add() andar hi EmbeddingModel (Ollama) se embeddings banata hai
 * aur content + metadata + embedding teeno vector_store table mein save karta hai.
 */
@Component
public class ChunkStore {

    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate;

    public ChunkStore(VectorStore vectorStore, JdbcTemplate jdbcTemplate) {
        this.vectorStore = vectorStore;
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Ek batch (20-50 chunks) ek saath embed + save */
    public void addBatch(List<CodeChunk> chunks) {
        vectorStore.add(chunks.stream().map(ChunkStore::toDocument).toList());
    }

    public int deleteByProject(Long projectId) {
        return jdbcTemplate.update(
                "DELETE FROM vector_store WHERE metadata->>'projectId' = ?", String.valueOf(projectId));
    }

    public long countByProject(Long projectId) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vector_store WHERE metadata->>'projectId' = ?",
                Long.class,
                String.valueOf(projectId));
        return count == null ? 0 : count;
    }

    /**
     * Metadata Week 4 ki citation (AuthService.java:42-60) isi se banegi.
     * Null values metadata mein nahi daalte.
     */
    private static Document toDocument(CodeChunk c) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("projectId", c.projectId());
        metadata.put("filePath", c.filePath());
        metadata.put("startLine", c.startLine());
        metadata.put("endLine", c.endLine());
        metadata.put("type", c.type().name());
        if (c.className() != null) {
            metadata.put("className", c.className());
        }
        if (c.methodName() != null) {
            metadata.put("methodName", c.methodName());
        }

        String id = (c.id() != null) ? c.id() : UUID.randomUUID().toString();
        return new Document(id, c.content(), metadata);
    }
}
