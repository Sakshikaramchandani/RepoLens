package com.repolens.github;

import com.repolens.common.ApiException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/** "https://github.com/owner/repo" ko owner + repo mein todta hai */
public record GithubRepoRef(String owner, String repo) {

    private static final Pattern GITHUB_URL = Pattern.compile(
            "^https?://(?:www\\.)?github\\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\\.git)?/?$");

    public static GithubRepoRef parse(String url) {
        if (url == null || url.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GitHub URL is required");
        }
        Matcher m = GITHUB_URL.matcher(url.trim());
        if (!m.matches()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Invalid GitHub URL. Use format https://github.com/owner/repo");
        }
        return new GithubRepoRef(m.group(1), m.group(2));
    }

    public String cloneUrl() {
        return "https://github.com/" + owner + "/" + repo + ".git";
    }

    public String canonicalUrl() {
        return "https://github.com/" + owner + "/" + repo;
    }
}
