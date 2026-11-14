package com.repolens.indexing;

import java.util.List;

/**
 * Ek file do, chunks ki list lo.
 * Sakshi ka AST chunker (JavaParser) isko implement karega aur @Primary lagayega.
 * Jab tak wo ready nahi, FallbackLineChunker chalega.
 */
public interface CodeChunker {

    List<CodeChunk> chunk(Long projectId, String filePath, String content);
}
