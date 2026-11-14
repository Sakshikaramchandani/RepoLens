package com.repolens.auth;

import com.repolens.auth.dto.AuthResponse;
import com.repolens.auth.dto.LoginRequest;
import com.repolens.auth.dto.RegisterRequest;
import com.repolens.auth.dto.UserResponse;
import com.repolens.common.ApiException;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth")
public class AuthController {

    private final AuthService authService;
    private final GithubLoginService githubLoginService;
    private final GoogleLoginService googleLoginService;
    private final AuthRateLimiter rateLimiter;

    public AuthController(
            AuthService authService,
            GithubLoginService githubLoginService,
            GoogleLoginService googleLoginService,
            AuthRateLimiter rateLimiter) {
        this.authService = authService;
        this.githubLoginService = githubLoginService;
        this.googleLoginService = googleLoginService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a new user, returns JWT")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        rateLimiter.checkRegister(http.getRemoteAddr());
        return authService.register(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password, returns JWT")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        rateLimiter.checkLogin(http.getRemoteAddr(), request.email());
        try {
            AuthResponse response = authService.login(request);
            rateLimiter.loginSucceeded(request.email());
            return response;
        } catch (ApiException e) {
            if (e.getStatus() == HttpStatus.UNAUTHORIZED) {
                rateLimiter.loginFailed(request.email());
            }
            throw e;
        }
    }

    @GetMapping("/providers")
    @Operation(summary = "Which sign-in methods this server offers (public)")
    public Map<String, Boolean> providers() {
        return Map.of("github", githubLoginService.isEnabled(), "google", googleLoginService.isEnabled());
    }

    @PostMapping("/google/start")
    @Operation(summary = "\"Continue with Google\": authorize URL to send the browser to (public)")
    public Map<String, String> googleStart() {
        return Map.of("url", googleLoginService.startUrl());
    }

    @PostMapping("/google/callback")
    @Operation(summary = "Finish Google sign-in: code + state from Google's redirect → JWT (public)")
    public AuthResponse googleCallback(@Valid @RequestBody OAuthCallbackRequest request, HttpServletRequest http) {
        rateLimiter.checkOAuth(http.getRemoteAddr());
        return googleLoginService.complete(request.code(), request.state());
    }

    @PostMapping("/github/start")
    @Operation(summary = "\"Continue with GitHub\": authorize URL to send the browser to (public)")
    public Map<String, String> githubStart() {
        return Map.of("url", githubLoginService.startUrl());
    }

    @PostMapping("/github/callback")
    @Operation(
            summary = "Finish GitHub sign-in: code + state from GitHub's redirect → JWT (public). "
                    + "Also connects the GitHub account for repository access")
    public AuthResponse githubCallback(@Valid @RequestBody OAuthCallbackRequest request, HttpServletRequest http) {
        rateLimiter.checkOAuth(http.getRemoteAddr());
        return githubLoginService.complete(request.code(), request.state());
    }

    public record OAuthCallbackRequest(
            @NotBlank String code, @NotBlank String state) {}

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Sign out everywhere: every token issued so far stops working")
    public void logout(@AuthenticationPrincipal User user) {
        authService.revokeSessions(user.getId());
    }

    @GetMapping("/me")
    @Operation(summary = "Get currently logged-in user (needs Bearer token)")
    public UserResponse me(@AuthenticationPrincipal User user) {
        return UserResponse.from(user);
    }
}
