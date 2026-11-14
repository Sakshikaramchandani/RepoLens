package com.repolens.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Google's registered redirect URI points at the backend. The JWT lives in the browser, so forward
 * the browser to the frontend callback page, which finishes sign-in. Only Google's own result
 * parameters are passed on — nothing else from the query string.
 */
@RestController
public class GoogleCallbackForwarder {

    private final GoogleLoginService googleLoginService;

    public GoogleCallbackForwarder(GoogleLoginService googleLoginService) {
        this.googleLoginService = googleLoginService;
    }

    @GetMapping("/login/oauth2/code/google")
    public ResponseEntity<Void> forward(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        UriComponentsBuilder target = UriComponentsBuilder.fromUriString(googleLoginService.frontendCallback());
        if (code != null) target.queryParam("code", code);
        if (state != null) target.queryParam("state", state);
        if (error != null) target.queryParam("error", error);
        String location = target.encode().build().toUriString();
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, location)
                .build();
    }
}
