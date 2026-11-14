package com.repolens.review;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class ReviewDtos {

    private ReviewDtos() {}

    public static final List<String> SEVERITIES = List.of("CRITICAL", "HIGH", "MEDIUM", "LOW");
    public static final List<String> CATEGORIES = List.of("BUG", "SECURITY", "PERFORMANCE", "MAINTAINABILITY");

    /** focus: optional extra instruction, e.g. "security" or "error handling". */
    public record ReviewRequest(
            @NotEmpty(message = "Choose at least one file") List<Long> fileIds,

            @Size(max = 200, message = "Focus must be at most 200 characters")
            String focus) {}

    /**
     * severity: CRITICAL | HIGH | MEDIUM | LOW
     * category: BUG | SECURITY | PERFORMANCE | MAINTAINABILITY
     * line: 1-based line in the file, 0 = whole file
     */
    public record ReviewIssue(
            String severity, String category, Long fileId, String file, int line, String issue, String suggestion) {}

    public record ReviewedFile(Long fileId, String path, boolean truncated) {}

    public record ReviewResponse(
            Long projectId,
            int totalIssues,
            List<ReviewIssue> issues,
            String summary,
            List<ReviewedFile> files,
            String model) {}
}
