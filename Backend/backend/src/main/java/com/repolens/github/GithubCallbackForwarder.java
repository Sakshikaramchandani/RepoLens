package com.repolens.github;

import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * If the OAuth app's callback URL points at the backend (a common setup, e.g.
 * http://localhost:8080/login/oauth2/code/github), GitHub sends the browser here. Forward it to
 * the frontend callback page, which finishes sign-in or connect with the user's session.
 * Only GitHub's own result parameters are passed on — nothing else from the query string.
 * "/" is included for apps whose callback is just http://localhost:8080 (without code it simply
 * sends the browser to the frontend).
 */
@RestController
public class GithubCallbackForwarder {

    private final GithubOAuthService oauthService;

    public GithubCallbackForwarder(GithubOAuthService oauthService) {
        this.oauthService = oauthService;
    }

    @GetMapping({
        "/",
        "/login/oauth2/code/github",
        "/api/auth/github/callback",
        "/api/github/oauth/callback",
        "/oauth/github/callback",
        "/github/callback",
        "/callback"
    })
    public ResponseEntity<Void> forward(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription) {
        UriComponentsBuilder target = UriComponentsBuilder.fromUriString(oauthService.frontendCallback());
        if (code != null) target.queryParam("code", code);
        if (state != null) target.queryParam("state", state);
        if (error != null) target.queryParam("error", error);
        if (errorDescription != null) target.queryParam("error_description", errorDescription);
        URI location = target.encode().build().toUri();
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, location.toString())
                .build();
    }
}
