package com.repolens.risk;

import com.repolens.chunking.IndexableFiles;
import com.repolens.file.ProjectFileReader;
import com.repolens.file.RepoFile;
import com.repolens.file.RepoFileRepository;
import com.repolens.history.FileHistory;
import com.repolens.history.FileHistoryService;
import com.repolens.language.Language;
import com.repolens.language.Languages;
import com.repolens.project.Project;
import com.repolens.project.ProjectService;
import com.repolens.risk.RiskDtos.FileRiskResponse;
import com.repolens.risk.RiskDtos.RiskReport;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Risk score of every production source file of a project, in any supported language
 * (tests, generated code, config and docs excluded). Java uses JavaParser; other languages use
 * structure patterns. When the project has git history, churn and bug-fix commits join the score.
 */
@Service
public class RiskService {

    private final ProjectService projectService;
    private final RepoFileRepository repoFileRepository;
    private final ProjectFileReader fileReader;
    private final FileHistoryService historyService;

    public RiskService(
            ProjectService projectService,
            RepoFileRepository repoFileRepository,
            ProjectFileReader fileReader,
            FileHistoryService historyService) {
        this.projectService = projectService;
        this.repoFileRepository = repoFileRepository;
        this.fileReader = fileReader;
        this.historyService = historyService;
    }

    @Transactional(readOnly = true)
    public RiskReport analyze(Long projectId, Long userId) {
        Project project = projectService.getOwnedProject(projectId, userId);
        boolean historyAvailable = project.getHistoryCommits() > 0;
        Map<String, FileHistory> history = historyAvailable ? historyService.forProject(projectId) : Map.of();

        List<FileRiskResponse> results = new ArrayList<>();
        TreeSet<String> languages = new TreeSet<>();
        for (RepoFile file : repoFileRepository.findByProjectIdOrderByPathAsc(projectId)) {
            Language language = Languages.detect(file.getPath()).orElse(null);
            if (language == null
                    || language.kind() != Language.Kind.CODE
                    || !IndexableFiles.isIndexable(file.getPath())) {
                continue;
            }
            String content = fileReader.read(userId, file).orElse(null);
            if (content == null || IndexableFiles.looksGenerated(content)) {
                continue;
            }
            JavaRiskAnalyzer.Metrics m = language == Language.JAVA
                    ? JavaRiskAnalyzer.analyze(content)
                    : GenericRiskAnalyzer.analyze(language, content);
            languages.add(language.displayName());
            results.add(
                    historyAvailable
                            ? withHistory(file, language, m, history.get(file.getPath()))
                            : response(file, language, m, m.score(), m.findings(), null, null, null, null));
        }
        results.sort(
                Comparator.comparingInt(FileRiskResponse::score).reversed().thenComparing(FileRiskResponse::filePath));

        int high = (int) results.stream().filter(r -> r.label().equals("HIGH")).count();
        int medium =
                (int) results.stream().filter(r -> r.label().equals("MEDIUM")).count();
        return new RiskReport(
                projectId,
                results.size(),
                high,
                medium,
                results.size() - high - medium,
                historyAvailable,
                project.getHistoryCommits(),
                List.copyOf(languages),
                results);
    }

    private static FileRiskResponse withHistory(
            RepoFile file, Language language, JavaRiskAnalyzer.Metrics m, FileHistory h) {
        int commits = h == null ? 0 : h.getCommits();
        int fixes = h == null ? 0 : h.getBugFixCommits();
        int score = JavaRiskAnalyzer.scoreWithHistory(
                m.maxMethodComplexity(), m.complexity(), m.loc(), m.warnings(), commits, fixes);
        List<String> findings = new ArrayList<>();
        if (fixes >= 2) {
            findings.add(fixes + " bug-fix commits touched this file");
        }
        if (commits >= 10) {
            findings.add("Changed in " + commits + " recent commits (high churn)");
        }
        findings.addAll(m.findings());
        return response(
                file,
                language,
                m,
                score,
                findings.size() > 6 ? findings.subList(0, 6) : findings,
                commits,
                fixes,
                h == null ? 0 : h.getAuthors(),
                h == null ? null : h.getLastChangedAt());
    }

    private static FileRiskResponse response(
            RepoFile file,
            Language language,
            JavaRiskAnalyzer.Metrics m,
            int score,
            List<String> findings,
            Integer churn,
            Integer fixes,
            Integer authors,
            LocalDateTime lastChanged) {
        return new FileRiskResponse(
                file.getId(),
                file.getPath(),
                language.displayName(),
                score,
                JavaRiskAnalyzer.label(score),
                m.complexity(),
                m.maxMethodComplexity(),
                m.loc(),
                m.methods(),
                churn,
                fixes,
                authors,
                lastChanged,
                m.warnings(),
                List.copyOf(findings));
    }
}
