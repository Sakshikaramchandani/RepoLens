package com.repolens.github;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;

class GithubCallbackForwarderTest {

    private final GithubCallbackForwarder forwarder = new GithubCallbackForwarder(new GithubOAuthService(
            null,
            null,
            null,
            WebClient.builder(),
            "https://github.com/login/oauth",
            "cid",
            "secret",
            "http://localhost:5173",
            "server-secret"));

    @Test
    void forwardsOnlyGithubResultParametersToTheFrontend() {
        ResponseEntity<Void> response = forwarder.forward("abc123", "st.ate", null, null);
        assertEquals(302, response.getStatusCode().value());
        assertEquals(
                "http://localhost:5173/integrations/github/callback?code=abc123&state=st.ate",
                response.getHeaders().getFirst(HttpHeaders.LOCATION));
    }

    @Test
    void forwardsGithubErrorsAndEncodesThem() {
        ResponseEntity<Void> response = forwarder.forward(null, null, "access_denied", "The user denied & left");
        String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
        assertTrue(location.startsWith("http://localhost:5173/integrations/github/callback?error=access_denied"));
        assertTrue(location.contains("error_description=The%20user%20denied%20%26%20left"));
    }
}
