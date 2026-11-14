package com.repolens.history;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Git change history of one file (V8). */
@Entity
@Table(name = "file_history")
public class FileHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false, length = 1024)
    private String path;

    @Column(nullable = false)
    private int commits;

    @Column(name = "bug_fix_commits", nullable = false)
    private int bugFixCommits;

    @Column(nullable = false)
    private int authors;

    @Column(name = "last_changed_at")
    private LocalDateTime lastChangedAt;

    protected FileHistory() {}

    public FileHistory(
            Long projectId, String path, int commits, int bugFixCommits, int authors, LocalDateTime lastChangedAt) {
        this.projectId = projectId;
        this.path = path;
        this.commits = commits;
        this.bugFixCommits = bugFixCommits;
        this.authors = authors;
        this.lastChangedAt = lastChangedAt;
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

    public int getCommits() {
        return commits;
    }

    public int getBugFixCommits() {
        return bugFixCommits;
    }

    public int getAuthors() {
        return authors;
    }

    public LocalDateTime getLastChangedAt() {
        return lastChangedAt;
    }
}
