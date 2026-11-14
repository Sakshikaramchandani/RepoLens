package com.repolens.file;

import com.repolens.project.SourceType;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "repo_files")
public class RepoFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false, length = 1000)
    private String path;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(nullable = false, length = 20)
    private String extension;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SourceType source;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RepoFile() {}

    public RepoFile(Long projectId, String path, String fileName, String extension, long sizeBytes, SourceType source) {
        this.projectId = projectId;
        this.path = path;
        this.fileName = fileName;
        this.extension = extension;
        this.sizeBytes = sizeBytes;
        this.source = source;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getPath() {
        return path;
    }

    public String getFileName() {
        return fileName;
    }

    public String getExtension() {
        return extension;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public SourceType getSource() {
        return source;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
