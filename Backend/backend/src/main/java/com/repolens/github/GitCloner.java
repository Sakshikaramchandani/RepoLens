package com.repolens.github;

import com.repolens.common.ApiException;
import java.nio.file.Path;
import java.util.List;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.TransportException;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Single-branch clone with the newest {@code app.github.history-depth} commits (default 300):
 * enough history for the risk map's churn and bug-fix counts, still far smaller than a full clone.
 */
@Component
public class GitCloner {

    private final int timeoutSeconds;
    private final int historyDepth;

    public GitCloner(
            @Value("${app.github.clone-timeout-seconds}") int timeoutSeconds,
            @Value("${app.github.history-depth}") int historyDepth) {
        this.timeoutSeconds = timeoutSeconds;
        this.historyDepth = Math.max(1, historyDepth);
    }

    public void cloneWithHistory(GithubRepoRef ref, String branch, String token, Path targetDir) {
        String branchRef = "refs/heads/" + branch;

        CloneCommand command = Git.cloneRepository()
                .setURI(ref.cloneUrl())
                .setDirectory(targetDir.toFile())
                .setBranch(branchRef)
                .setBranchesToClone(List.of(branchRef))
                .setCloneAllBranches(false)
                .setDepth(historyDepth)
                .setTimeout(timeoutSeconds);

        if (token != null && !token.isBlank()) {
            // GitHub token ke saath username kuch bhi chalta hai, password ki jagah token
            command.setCredentialsProvider(new UsernamePasswordCredentialsProvider("x-access-token", token));
        }

        try (Git git = command.call()) {
            // clone ho gaya, Git object close karna zaroori hai (file locks chhodne ke liye)
        } catch (TransportException e) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Could not clone repository (network, access or branch problem): " + e.getMessage());
        } catch (GitAPIException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Git clone failed: " + e.getMessage());
        }
    }
}
