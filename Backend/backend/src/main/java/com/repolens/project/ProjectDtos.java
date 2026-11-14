package com.repolens.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public final class ProjectDtos {

    private ProjectDtos() {}

    public record CreateProjectRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description) {}

    public record UpdateProjectRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description) {}

    /** sourceType: NONE | ZIP | GITHUB */
    public record ProjectResponse(
            Long id, String name, String description, String sourceType, LocalDateTime createdAt) {}

    public record UploadResponse(int filesSaved, int filesSkipped) {}

    /** token optional (public repo ke liye nahi chahiye). DB mein AES-encrypted save hoga */
    public record GithubImportRequest(@NotBlank String repoUrl, String branch, String token) {}

    public record GithubImportResponse(
            String branch, String latestCommitSha, String latestCommitMessage, int filesSaved) {}

    /** type: FILE | DIR. DIR ke liye fileId null, FILE ke liye children null */
    public record FileNode(String name, String path, String type, Long fileId, List<FileNode> children) {}

    public record FileContentResponse(Long fileId, String path, String extension, String content) {}
}
