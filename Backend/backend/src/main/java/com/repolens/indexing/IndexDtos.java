package com.repolens.indexing;

public final class IndexDtos {

    private IndexDtos() {}

    /** status: QUEUED | RUNNING | DONE | FAILED. progress: 0-100 */
    public record IndexJobResponse(
            Long jobId,
            Long projectId,
            String status,
            int progress,
            int totalFiles,
            int processedFiles,
            String errorMessage) {}
}
