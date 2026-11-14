package com.repolens.history;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Computes and stores per-file git history for a project (called by the GitHub and ZIP imports). */
@Service
public class FileHistoryService {

    private static final Logger log = LoggerFactory.getLogger(FileHistoryService.class);

    private final FileHistoryRepository repository;
    private final int maxCommits;

    public FileHistoryService(FileHistoryRepository repository, @Value("${app.github.history-depth}") int maxCommits) {
        this.repository = repository;
        this.maxCommits = maxCommits;
    }

    /**
     * Reads the git directory and keeps stats only for files the project actually stores.
     * pathPrefix = where the repository root sits inside the project ("" for a GitHub clone,
     * "my-repo/" for a ZIP whose files are under a top folder). Never fails the import: history is
     * a bonus, so errors are logged and the project simply has none.
     *
     * @return how many commits were read (0 = no history)
     */
    public GitHistoryAnalyzer.Result read(Path gitDir, String pathPrefix, Set<String> keptPaths) {
        if (gitDir == null || !Files.isDirectory(gitDir) || !Files.exists(gitDir.resolve("HEAD"))) {
            return GitHistoryAnalyzer.Result.empty();
        }
        try (Repository repo = new FileRepositoryBuilder()
                .setGitDir(gitDir.toFile())
                .setMustExist(true)
                .build()) {
            GitHistoryAnalyzer.Result result = GitHistoryAnalyzer.analyze(repo, maxCommits);
            Map<String, GitHistoryAnalyzer.Stats> kept = new HashMap<>();
            result.files().forEach((path, stats) -> {
                String projectPath = pathPrefix + path;
                if (keptPaths.contains(projectPath)) {
                    kept.put(projectPath, stats);
                }
            });
            return new GitHistoryAnalyzer.Result(kept, result.commitsRead());
        } catch (Exception e) {
            log.warn("Could not read git history from {}: {}", gitDir, e.toString());
            return GitHistoryAnalyzer.Result.empty();
        }
    }

    /** Replaces the project's stored history. */
    @Transactional
    public void replace(Long projectId, Map<String, GitHistoryAnalyzer.Stats> files) {
        repository.deleteByProjectId(projectId);
        List<FileHistory> rows = new ArrayList<>(files.size());
        files.forEach((path, s) -> rows.add(new FileHistory(
                projectId,
                path,
                s.commits(),
                s.bugFixCommits(),
                s.authors(),
                s.lastChanged() == null ? null : LocalDateTime.ofInstant(s.lastChanged(), ZoneOffset.UTC))));
        repository.saveAll(rows);
    }

    @Transactional(readOnly = true)
    public Map<String, FileHistory> forProject(Long projectId) {
        Map<String, FileHistory> byPath = new HashMap<>();
        for (FileHistory h : repository.findByProjectId(projectId)) {
            byPath.put(h.getPath(), h);
        }
        return byPath;
    }
}
