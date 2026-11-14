package com.repolens.indexing;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "index_jobs")
public class IndexJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IndexJobStatus status = IndexJobStatus.QUEUED;

    @Column(nullable = false)
    private int progress;

    @Column(name = "total_files", nullable = false)
    private int totalFiles;

    @Column(name = "processed_files", nullable = false)
    private int processedFiles;

    @Column(name = "total_chunks", nullable = false)
    private int totalChunks;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    protected IndexJob() {}

    public IndexJob(Long projectId) {
        this.projectId = projectId;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public void start() {
        status = IndexJobStatus.RUNNING;
        startedAt = LocalDateTime.now();
    }

    public void setTotalFiles(int totalFiles) {
        this.totalFiles = totalFiles;
    }

    /** Ek file ho gayi. 100% sirf DONE par, isliye yahan max 99 */
    public void fileProcessed() {
        processedFiles++;
        progress = (totalFiles == 0) ? 0 : Math.min(99, processedFiles * 100 / totalFiles);
    }

    public void markDone(int totalChunks) {
        this.totalChunks = totalChunks;
        status = IndexJobStatus.DONE;
        progress = 100;
        finishedAt = LocalDateTime.now();
    }

    public void markFailed(String message) {
        status = IndexJobStatus.FAILED;
        errorMessage = (message != null && message.length() > 1000) ? message.substring(0, 1000) : message;
        finishedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public IndexJobStatus getStatus() {
        return status;
    }

    public int getProgress() {
        return progress;
    }

    public int getTotalFiles() {
        return totalFiles;
    }

    public int getProcessedFiles() {
        return processedFiles;
    }

    public int getTotalChunks() {
        return totalChunks;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getFinishedAt() {
        return finishedAt;
    }
}
