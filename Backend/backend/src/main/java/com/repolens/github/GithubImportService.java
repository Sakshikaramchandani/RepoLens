package com.repolens.github;

import com.repolens.common.ApiException;
import com.repolens.file.RepoFileService;
import com.repolens.history.FileHistoryService;
import com.repolens.history.GitHistoryAnalyzer;
import com.repolens.project.Project;
import com.repolens.project.ProjectDtos.GithubImportRequest;
import com.repolens.project.ProjectDtos.GithubImportResponse;
import com.repolens.project.ProjectService;
import com.repolens.project.SourceType;
import com.repolens.storage.StorageService;
import java.io.IOException;
import java.nio.file.Path;
import java.util.regex.Pattern;
import org.eclipse.jgit.util.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Flow:
 * 1. Ownership check (Apoorv ka ProjectService)
 * 2. URL parse -> owner/repo
 * 3. GitHub API: default branch, size, latest commit
 * 4. Temp folder mein clone, last N commits (JGit) — history risk map ke liye
 * 5. Sirf code files doosre temp folder mein copy
 * 6. Wo folder storage/{userId}/{projectId} par move (ZIP jaisa hi)
 * 7. Purani RepoFile rows hatao, nayi SourceType.GITHUB ke saath register karo
 * 8. GithubSource save (token encrypted)
 */
@Service
public class GithubImportService {

    private static final Logger log = LoggerFactory.getLogger(GithubImportService.class);
    private static final Pattern BRANCH_NAME = Pattern.compile("^[A-Za-z0-9._/-]{1,200}$");

    private final ProjectService projectService;
    private final RepoFileService repoFileService;
    private final StorageService storageService;
    private final GithubApiClient githubApiClient;
    private final GitCloner gitCloner;
    private final RepoFileCopier repoFileCopier;
    private final TokenEncryptor tokenEncryptor;
    private final GithubSourceRepository githubSourceRepository;
    private final GithubOAuthService githubOAuthService;
    private final FileHistoryService fileHistoryService;
    private final long maxRepoSizeMb;

    public GithubImportService(
            ProjectService projectService,
            RepoFileService repoFileService,
            StorageService storageService,
            GithubApiClient githubApiClient,
            GitCloner gitCloner,
            RepoFileCopier repoFileCopier,
            TokenEncryptor tokenEncryptor,
            GithubSourceRepository githubSourceRepository,
            GithubOAuthService githubOAuthService,
            FileHistoryService fileHistoryService,
            @Value("${app.github.max-repo-size-mb}") long maxRepoSizeMb) {
        this.projectService = projectService;
        this.repoFileService = repoFileService;
        this.storageService = storageService;
        this.githubApiClient = githubApiClient;
        this.gitCloner = gitCloner;
        this.repoFileCopier = repoFileCopier;
        this.tokenEncryptor = tokenEncryptor;
        this.githubSourceRepository = githubSourceRepository;
        this.githubOAuthService = githubOAuthService;
        this.fileHistoryService = fileHistoryService;
        this.maxRepoSizeMb = maxRepoSizeMb;
    }

    @Transactional
    public GithubImportResponse importRepository(Long projectId, Long userId, GithubImportRequest request) {
        Project project = projectService.getOwnedProject(projectId, userId);
        GithubRepoRef ref = GithubRepoRef.parse(request.repoUrl());

        GithubSource source =
                githubSourceRepository.findByProjectId(projectId).orElseGet(() -> new GithubSource(projectId));

        String token = resolveToken(request.token(), source, ref, userId);

        // GitHub API se info
        GithubApiClient.RepoInfo info = githubApiClient.getRepoInfo(ref, token);
        if (info.sizeKb() > maxRepoSizeMb * 1024L) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Repository is too large (" + (info.sizeKb() / 1024) + " MB). Max is " + maxRepoSizeMb + " MB");
        }
        String branch = chooseBranch(request.branch(), info.defaultBranch());
        GithubApiClient.CommitInfo commit = githubApiClient.getLatestCommit(ref, branch, token);

        // Clone + filter + move
        Path cloneDir = storageService.createTempDir();
        Path filteredDir = storageService.createTempDir();
        RepoFileCopier.CopyResult result;
        GitHistoryAnalyzer.Result history;
        try {
            gitCloner.cloneWithHistory(ref, branch, token, cloneDir);
            result = repoFileCopier.copyAllowedFiles(cloneDir, filteredDir);
            history = fileHistoryService.read(
                    cloneDir.resolve(".git"), "", result.files().keySet());
            storageService.replaceProjectDir(userId, projectId, filteredDir);
        } catch (IOException e) {
            storageService.deleteQuietly(filteredDir);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save repository files");
        } catch (RuntimeException e) {
            storageService.deleteQuietly(filteredDir);
            throw e;
        } finally {
            deleteCloneDir(cloneDir);
        }

        // Re-import = replace (ZIP jaisa hi)
        repoFileService.deleteAllForProject(projectId);
        result.files().forEach((path, size) -> repoFileService.register(projectId, path, size, SourceType.GITHUB));
        fileHistoryService.replace(projectId, history.files());
        project.setHistoryCommits(history.commitsRead());

        // Source info save. Naya token diya toh encrypt karo, warna purana rakho (same repo ho toh)
        String encryptedToken;
        if (request.token() != null && !request.token().isBlank()) {
            encryptedToken = tokenEncryptor.encrypt(request.token().trim());
        } else {
            encryptedToken = isSameRepo(source, ref) ? source.getEncryptedToken() : null;
        }
        source.recordImport(
                ref.canonicalUrl(),
                ref.owner(),
                ref.repo(),
                branch,
                commit.sha(),
                truncate(commit.message(), 1000),
                encryptedToken);
        githubSourceRepository.save(source);

        project.setSourceType(SourceType.GITHUB);

        // Token kabhi log mat karna
        log.info(
                "GitHub import done: project={} repo={} branch={} files={}",
                projectId,
                ref.canonicalUrl(),
                branch,
                result.files().size());

        return new GithubImportResponse(
                branch, commit.sha(), commit.message(), result.files().size());
    }

    /**
     * Token priority: the one in this request > the one saved for this project's repo >
     * the user's connected GitHub account (OAuth) > none (public repo).
     */
    private String resolveToken(String requestToken, GithubSource source, GithubRepoRef ref, Long userId) {
        if (requestToken != null && !requestToken.isBlank()) {
            return requestToken.trim();
        }
        if (source.getEncryptedToken() != null && isSameRepo(source, ref)) {
            return tokenEncryptor.decrypt(source.getEncryptedToken());
        }
        return githubOAuthService.tokenFor(userId).orElse(null);
    }

    private boolean isSameRepo(GithubSource source, GithubRepoRef ref) {
        return source.getRepoUrl() != null && source.getRepoUrl().equalsIgnoreCase(ref.canonicalUrl());
    }

    private String chooseBranch(String requested, String defaultBranch) {
        if (requested == null || requested.isBlank()) {
            return defaultBranch;
        }
        String branch = requested.trim();
        if (!BRANCH_NAME.matcher(branch).matches() || branch.contains("..")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid branch name");
        }
        return branch;
    }

    /** JGit .git ki kuch files read-only banata hai (Windows par normal delete fail). JGit ka FileUtils handle kar leta hai */
    private void deleteCloneDir(Path cloneDir) {
        try {
            FileUtils.delete(cloneDir.toFile(), FileUtils.RECURSIVE | FileUtils.RETRY | FileUtils.SKIP_MISSING);
        } catch (IOException e) {
            log.warn("Could not delete clone dir {}", cloneDir, e);
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
