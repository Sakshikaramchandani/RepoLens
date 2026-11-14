package com.repolens.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.repolens.common.ApiException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Component
public class GithubApiClient {

    public record RepoInfo(String defaultBranch, long sizeKb, boolean isPrivate) {}

    public record CommitInfo(String sha, String message) {}

    public record GithubUser(String login, String avatarUrl) {}

    /** One repository from GET /user/repos. */
    public record RepoSummary(
            String fullName,
            String name,
            String owner,
            boolean isPrivate,
            String description,
            String defaultBranch,
            String htmlUrl,
            String language,
            String pushedAt,
            long sizeKb,
            int stars) {}

    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private final WebClient webClient;

    public GithubApiClient(WebClient.Builder builder, @Value("${app.github.api-url}") String apiUrl) {
        this.webClient = builder.baseUrl(apiUrl)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .defaultHeader(HttpHeaders.USER_AGENT, "RepoLens")
                .build();
    }

    /** GET /repos/{owner}/{repo} -> default branch, size (KB), private hai ya nahi */
    public RepoInfo getRepoInfo(GithubRepoRef ref, String token) {
        JsonNode json = get(token, "/repos/{owner}/{repo}", ref.owner(), ref.repo());
        return new RepoInfo(
                json.path("default_branch").asText("main"),
                json.path("size").asLong(0),
                json.path("private").asBoolean(false));
    }

    /** GET /repos/{owner}/{repo}/commits/{branch} -> latest commit SHA + message ki pehli line */
    public CommitInfo getLatestCommit(GithubRepoRef ref, String branch, String token) {
        // List endpoint, not /commits/{sha}: the single-commit response embeds every file's diff, and a
        // big commit blows past WebClient's 256 KB buffer ("GitHub API error: 200"). The list has no diffs.
        JsonNode list =
                get(token, "/repos/{owner}/{repo}/commits?sha={branch}&per_page=1", ref.owner(), ref.repo(), branch);
        if (!list.isArray() || list.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Branch '" + branch + "' has no commits");
        }
        JsonNode json = list.get(0);
        String fullMessage = json.path("commit").path("message").asText("");
        String firstLine = fullMessage.lines().findFirst().orElse("");
        return new CommitInfo(json.path("sha").asText(""), firstLine);
    }

    /** GET /user -> login + avatar of the token's owner */
    public GithubUser getUser(String token) {
        JsonNode json = get(token, "/user");
        return new GithubUser(
                json.path("login").asText(""), json.path("avatar_url").asText(null));
    }

    /**
     * GET /user/emails (scope user:email) -> the primary verified address, else any verified one.
     * Unverified addresses are never used: they would let anyone claim someone else's account.
     */
    public Optional<String> verifiedEmail(String token) {
        JsonNode emails = get(token, "/user/emails");
        String fallback = null;
        for (JsonNode e : emails) {
            if (!e.path("verified").asBoolean(false)) {
                continue;
            }
            String address = e.path("email").asText("");
            if (address.isBlank() || address.endsWith("@users.noreply.github.com")) {
                continue;
            }
            if (e.path("primary").asBoolean(false)) {
                return Optional.of(address);
            }
            if (fallback == null) {
                fallback = address;
            }
        }
        return Optional.ofNullable(fallback);
    }

    /** GET /user/repos, most recently pushed first. page starts at 1, 100 per page. */
    public List<RepoSummary> listRepos(String token, int page) {
        JsonNode json = get(
                token,
                "/user/repos?per_page=100&page={page}&sort=pushed&affiliation=owner,collaborator,organization_member",
                page);
        List<RepoSummary> repos = new ArrayList<>();
        json.forEach(r -> repos.add(new RepoSummary(
                r.path("full_name").asText(),
                r.path("name").asText(),
                r.path("owner").path("login").asText(),
                r.path("private").asBoolean(false),
                r.path("description").isNull() ? null : r.path("description").asText(null),
                r.path("default_branch").asText("main"),
                r.path("html_url").asText(),
                r.path("language").isNull() ? null : r.path("language").asText(null),
                r.path("pushed_at").asText(null),
                r.path("size").asLong(0),
                r.path("stargazers_count").asInt(0))));
        return repos;
    }

    private JsonNode get(String token, String uri, Object... uriVariables) {
        try {
            JsonNode body = webClient
                    .get()
                    .uri(uri, uriVariables)
                    .headers(h -> {
                        if (token != null && !token.isBlank()) {
                            h.setBearerAuth(token);
                        }
                    })
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(TIMEOUT);

            if (body == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Empty response from GitHub");
            }
            return body;

        } catch (WebClientResponseException e) {
            throw switch (e.getStatusCode().value()) {
                case 401 -> new ApiException(HttpStatus.BAD_REQUEST, "GitHub token is invalid or expired");
                case 403, 429 ->
                    new ApiException(
                            HttpStatus.BAD_REQUEST,
                            "GitHub refused the request (rate limit or no access). Try later or add a token");
                case 404 ->
                    new ApiException(
                            HttpStatus.NOT_FOUND,
                            "Repository or branch not found on GitHub. If it is private, add a token");
                default ->
                    new ApiException(
                            HttpStatus.BAD_GATEWAY,
                            "GitHub API error: " + e.getStatusCode().value());
            };
        } catch (WebClientRequestException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub. Check your internet connection");
        } catch (IllegalStateException e) { // block() timeout
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "GitHub API timed out");
        }
    }
}
