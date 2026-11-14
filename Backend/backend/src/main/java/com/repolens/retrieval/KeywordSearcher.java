package com.repolens.retrieval;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * PostgreSQL full-text search on vector_store.content_tsv (V5).
 * Class / method / variable ka exact naam poocha ho toh ye pakad leta hai,
 * jahan vector search kabhi-kabhi chook jaata hai.
 */
@Component
public class KeywordSearcher {

    private static final String SQL = """
            SELECT id::text                AS id,
                   content,
                   metadata->>'filePath'   AS file_path,
                   metadata->>'startLine'  AS start_line,
                   metadata->>'endLine'    AS end_line,
                   metadata->>'className'  AS class_name,
                   metadata->>'methodName' AS method_name
            FROM vector_store, to_tsquery('simple', ?) AS q
            WHERE metadata->>'projectId' = ?
              AND content_tsv @@ q
            ORDER BY ts_rank_cd(content_tsv, q) DESC
            LIMIT ?
            """;

    private final JdbcTemplate jdbcTemplate;

    public KeywordSearcher(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<RetrievedChunk> search(Long projectId, String question, int topK) {
        List<String> tokens = QueryTokenizer.tokens(question);
        if (tokens.isEmpty()) {
            return List.of(); // sawal mein sirf filler words the
        }
        return jdbcTemplate.query(
                SQL,
                (rs, rowNum) -> new RetrievedChunk(
                        rs.getString("id"),
                        VectorSearcher.stringOf(rs.getString("file_path")),
                        VectorSearcher.intOf(rs.getString("start_line")),
                        VectorSearcher.intOf(rs.getString("end_line")),
                        rs.getString("class_name"),
                        rs.getString("method_name"),
                        rs.getString("content") == null ? "" : rs.getString("content"),
                        0,
                        null,
                        null),
                QueryTokenizer.toTsQuery(tokens),
                String.valueOf(projectId),
                topK);
    }
}
