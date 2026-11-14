package com.repolens.github;

import com.repolens.user.AvatarSource;
import com.repolens.user.ProfileService;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/github")
@Tag(name = "GitHub account")
public class GithubController {

    public record OAuthCallbackRequest(
            @NotBlank String code, @NotBlank String state) {}

    private final GithubOAuthService oauthService;
    private final ProfileService profileService;

    public GithubController(GithubOAuthService oauthService, ProfileService profileService) {
        this.oauthService = oauthService;
        this.profileService = profileService;
    }

    @GetMapping("/connection")
    @Operation(summary = "Is GitHub sign-in available on this server, and is this user connected?")
    public GithubOAuthService.ConnectionStatus connection(@AuthenticationPrincipal User user) {
        return oauthService.status(user.getId());
    }

    @PostMapping("/oauth/start")
    @Operation(summary = "GitHub authorize URL (send the browser there)")
    public Map<String, String> start(@AuthenticationPrincipal User user) {
        return Map.of("url", oauthService.start(user.getId()));
    }

    @PostMapping("/oauth/callback")
    @Operation(summary = "Finish connecting: code + state from GitHub's redirect")
    public GithubOAuthService.ConnectionStatus callback(
            @Valid @RequestBody OAuthCallbackRequest request, @AuthenticationPrincipal User user) {
        GithubOAuthService.ConnectionStatus status =
                oauthService.complete(user.getId(), request.code(), request.state());
        // use the GitHub picture unless the user uploaded / picked another one
        profileService.applyProviderPicture(user.getId(), AvatarSource.GITHUB, status.avatarUrl());
        return status;
    }

    @DeleteMapping("/connection")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Forget the stored GitHub token")
    public void disconnect(@AuthenticationPrincipal User user) {
        oauthService.disconnect(user.getId());
    }

    @GetMapping("/repos")
    @Operation(summary = "Repositories of the connected account (most recently pushed first)")
    public List<GithubApiClient.RepoSummary> repos(
            @RequestParam(required = false) String q, @AuthenticationPrincipal User user) {
        return oauthService.repos(user.getId(), q);
    }
}
