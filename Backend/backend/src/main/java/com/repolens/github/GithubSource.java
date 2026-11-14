package com.repolens.github;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "github_sources")
public class GithubSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false, unique = true)
    private Long projectId;

    @Column(name = "repo_url", nullable = false, length = 500)
    private String repoUrl;

    @Column(name = "repo_owner", nullable = false, length = 100)
    private String repoOwner;

    @Column(name = "repo_name", nullable = false, length = 100)
    private String repoName;

    @Column(nullable = false, length = 200)
    private String branch;

    @Column(name = "latest_commit_sha", length = 64)
    private String latestCommitSha;

    @Column(name = "latest_commit_message", length = 1000)
    private String latestCommitMessage;

    /** AES-encrypted token. Plain token kabhi DB mein nahi */
    @Column(name = "encrypted_token", length = 1000)
    private String encryptedToken;

    @Column(name = "last_imported_at")
    private LocalDateTime lastImportedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected GithubSource() {}

    public GithubSource(Long projectId) {
        this.projectId = projectId;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void recordImport(
            String repoUrl,
            String repoOwner,
            String repoName,
            String branch,
            String latestCommitSha,
            String latestCommitMessage,
            String encryptedToken) {
        this.repoUrl = repoUrl;
        this.repoOwner = repoOwner;
        this.repoName = repoName;
        this.branch = branch;
        this.latestCommitSha = latestCommitSha;
        this.latestCommitMessage = latestCommitMessage;
        this.encryptedToken = encryptedToken;
        this.lastImportedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getRepoUrl() {
        return repoUrl;
    }

    public String getRepoOwner() {
        return repoOwner;
    }

    public String getRepoName() {
        return repoName;
    }

    public String getBranch() {
        return branch;
    }

    public String getLatestCommitSha() {
        return latestCommitSha;
    }

    public String getLatestCommitMessage() {
        return latestCommitMessage;
    }

    public String getEncryptedToken() {
        return encryptedToken;
    }

    public LocalDateTime getLastImportedAt() {
        return lastImportedAt;
    }
}
