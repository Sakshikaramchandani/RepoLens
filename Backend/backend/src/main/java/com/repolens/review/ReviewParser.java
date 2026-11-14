package com.repolens.review;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repolens.common.ApiException;
import com.repolens.review.ReviewDtos.ReviewIssue;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Turns the model's answer into trusted review issues:
 * tolerates ```json fences and text around the object, normalises severity/category,
 * drops issues for files that were not reviewed, clamps lines into the file, sorts by severity.
 */
@Component
public class ReviewParser {

    static final int MAX_ISSUES = 50;
    private static final int MAX_TEXT = 1200;

    public record Parsed(String summary, List<ReviewIssue> issues) {}

    private final ObjectMapper objectMapper;

    public ReviewParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    Parsed parse(String answer, Map<String, ReviewService.FileForReview> files) {
        JsonNode root = readObject(answer);
        String summary = clean(root.path("summary").asText(""), 600);

        List<ReviewIssue> issues = new ArrayList<>();
        for (JsonNode node : root.path("issues")) {
            ReviewService.FileForReview file = matchFile(node.path("file").asText(""), files);
            String issue = clean(node.path("issue").asText(""), MAX_TEXT);
            if (file == null || issue.isEmpty()) {
                continue; // unknown file or empty issue = invented, drop it
            }
            int line = node.path("line").asInt(0);
            if (line < 0 || line > file.lineCount()) {
                line = 0;
            }
            issues.add(new ReviewIssue(
                    oneOf(node.path("severity").asText(""), ReviewDtos.SEVERITIES, "MEDIUM"),
                    oneOf(node.path("category").asText(""), ReviewDtos.CATEGORIES, "MAINTAINABILITY"),
                    file.file().getId(),
                    file.file().getPath(),
                    line,
                    issue,
                    clean(node.path("suggestion").asText(""), MAX_TEXT)));
        }
        issues.sort(Comparator.comparingInt((ReviewIssue i) -> ReviewDtos.SEVERITIES.indexOf(i.severity()))
                .thenComparing(ReviewIssue::file)
                .thenComparingInt(ReviewIssue::line));
        return new Parsed(summary, issues.size() > MAX_ISSUES ? List.copyOf(issues.subList(0, MAX_ISSUES)) : issues);
    }

    private JsonNode readObject(String answer) {
        if (answer != null) {
            int start = answer.indexOf('{');
            int end = answer.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    JsonNode node = objectMapper.readTree(answer.substring(start, end + 1));
                    if (node.isObject()) {
                        return node;
                    }
                } catch (Exception ignored) {
                    // fall through to the error below
                }
            }
        }
        throw new ApiException(
                HttpStatus.BAD_GATEWAY, "The AI returned a review that could not be read. Please try again");
    }

    /** Exact path, else unique match by path suffix / file name (models sometimes shorten paths). */
    private static ReviewService.FileForReview matchFile(
            String reported, Map<String, ReviewService.FileForReview> files) {
        String path = reported.trim().replace('\\', '/');
        if (path.isEmpty()) {
            return files.size() == 1 ? files.values().iterator().next() : null;
        }
        ReviewService.FileForReview exact = files.get(path);
        if (exact != null) {
            return exact;
        }
        List<ReviewService.FileForReview> candidates = files.values().stream()
                .filter(f -> f.file().getPath().endsWith("/" + path)
                        || path.endsWith("/" + f.file().getPath())
                        || f.file().getFileName().equals(path))
                .toList();
        return candidates.size() == 1 ? candidates.get(0) : null;
    }

    private static String oneOf(String value, List<String> allowed, String fallback) {
        String upper = value.trim().toUpperCase(Locale.ROOT);
        return allowed.contains(upper) ? upper : fallback;
    }

    private static String clean(String text, int max) {
        String t = text == null ? "" : text.trim();
        return t.length() > max ? t.substring(0, max) + "…" : t;
    }
}
