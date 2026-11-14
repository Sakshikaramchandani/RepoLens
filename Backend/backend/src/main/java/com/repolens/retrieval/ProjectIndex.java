package com.repolens.retrieval;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Read-only questions about a project's indexed chunks (vector_store), beyond similarity search. */
@Component
public class ProjectIndex {

    private static final String FILES_SQL = """
            SELECT DISTINCT metadata->>'filePath' AS file_path
            FROM vector_store
            WHERE metadata->>'projectId' = ?
            ORDER BY 1
            """;

    /** The outline of a file: its first CLASS chunk, else its first chunk. */
    private static final String OUTLINE_SQL = """
            SELECT DISTINCT ON (metadata->>'filePath')
                   id::text                AS id,
                   content,
                   metadata->>'filePath'   AS file_path,
                   metadata->>'startLine'  AS start_line,
                   metadata->>'endLine'    AS end_line,
                   metadata->>'className'  AS class_name,
                   metadata->>'methodName' AS method_name
            FROM vector_store
            WHERE metadata->>'projectId' = ?
              AND metadata->>'filePath' IN (%s)
            ORDER BY metadata->>'filePath',
                     CASE WHEN metadata->>'type' = 'CLASS' THEN 0 ELSE 1 END,
                     (metadata->>'startLine')::int
            """;

    private final JdbcTemplate jdbcTemplate;

    public ProjectIndex(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Every indexed file path of the project, sorted. */
    public List<String> files(Long projectId) {
        return jdbcTemplate.queryForList(FILES_SQL, String.class, String.valueOf(projectId));
    }

    /** One overview chunk per requested file (files without chunks are left out), in request order. */
    public List<RetrievedChunk> outlines(Long projectId, Collection<String> filePaths) {
        if (filePaths.isEmpty()) {
            return List.of();
        }
        List<Object> args = new ArrayList<>();
        args.add(String.valueOf(projectId));
        args.addAll(filePaths);
        String sql = OUTLINE_SQL.formatted(String.join(",", Collections.nCopies(filePaths.size(), "?")));
        Map<String, RetrievedChunk> byPath = new LinkedHashMap<>();
        jdbcTemplate.query(
                sql,
                rs -> {
                    RetrievedChunk chunk = new RetrievedChunk(
                            rs.getString("id"),
                            VectorSearcher.stringOf(rs.getString("file_path")),
                            VectorSearcher.intOf(rs.getString("start_line")),
                            VectorSearcher.intOf(rs.getString("end_line")),
                            rs.getString("class_name"),
                            rs.getString("method_name"),
                            rs.getString("content") == null ? "" : rs.getString("content"),
                            0,
                            null,
                            null);
                    byPath.put(chunk.filePath(), chunk);
                },
                args.toArray());
        List<RetrievedChunk> ordered = new ArrayList<>();
        for (String path : filePaths) {
            RetrievedChunk chunk = byPath.get(path);
            if (chunk != null) {
                ordered.add(chunk);
            }
        }
        return ordered;
    }
}
