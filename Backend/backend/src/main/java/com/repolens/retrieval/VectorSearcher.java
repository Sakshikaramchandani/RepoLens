package com.repolens.retrieval;

import java.util.List;
import java.util.Map;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Component;

/**
 * Sawal ka embedding banta hai (nomic-embed-text), phir PGVector meaning mein
 * sabse paas wale chunks deta hai. "login" poocho toh authenticate() bhi mil jaata hai.
 */
@Component
public class VectorSearcher {

    private final VectorStore vectorStore;

    public VectorSearcher(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    public List<RetrievedChunk> search(Long projectId, String question, int topK) {
        List<Document> docs = vectorStore.similaritySearch(SearchRequest.builder()
                .query(question)
                .topK(topK)
                .filterExpression("projectId == " + projectId) // sirf isi project ke chunks
                .build());
        return docs.stream().map(VectorSearcher::toChunk).toList();
    }

    private static RetrievedChunk toChunk(Document d) {
        Map<String, Object> m = d.getMetadata();
        return new RetrievedChunk(
                d.getId(),
                stringOf(m.get("filePath")),
                intOf(m.get("startLine")),
                intOf(m.get("endLine")),
                (String) m.get("className"),
                (String) m.get("methodName"),
                d.getText() == null ? "" : d.getText(),
                0,
                null,
                null);
    }

    static String stringOf(Object value) {
        return value == null ? "" : value.toString();
    }

    static int intOf(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        try {
            return value == null ? 0 : Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
