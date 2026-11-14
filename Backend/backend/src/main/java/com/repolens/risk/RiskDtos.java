package com.repolens.risk;

import java.time.LocalDateTime;
import java.util.List;

public final class RiskDtos {

    private RiskDtos() {}

    /**
     * score 0-100, label HIGH | MEDIUM | LOW. The other fields explain the score.
     * churn / bugFixCommits / authors / lastChanged come from git history; projects without history
     * (a ZIP without its .git folder) get null rather than a misleading 0.
     */
    public record FileRiskResponse(
            Long fileId,
            String filePath,
            String language,
            int score,
            String label,
            int complexity,
            int maxMethodComplexity,
            int loc,
            int methods,
            Integer churn,
            Integer bugFixCommits,
            Integer authors,
            LocalDateTime lastChanged,
            int warnings,
            List<String> findings) {}

    /** historyCommits = how many commits the history covers (0 = none). */
    public record RiskReport(
            Long projectId,
            int filesAnalyzed,
            int high,
            int medium,
            int low,
            boolean historyAvailable,
            int historyCommits,
            List<String> languages,
            List<FileRiskResponse> files) {}
}
