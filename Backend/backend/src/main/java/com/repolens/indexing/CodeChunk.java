package com.repolens.indexing;

/**
 * Sakshi aur Apoorv ke beech ka contract. Monday ke baad mat badalna.
 * id: UUID string ya null (null ho toh ChunkStore UUID de dega)
 * startLine/endLine: 1-based
 */
public record CodeChunk(
        String id,
        Long projectId,
        String filePath,
        String className,
        String methodName,
        int startLine,
        int endLine,
        String content,
        ChunkType type) {}
