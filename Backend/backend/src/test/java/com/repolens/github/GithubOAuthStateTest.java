package com.repolens.github;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class GithubOAuthStateTest {

    private GithubOAuthService service(String secret, String clientId) {
        return new GithubOAuthService(
                null,
                null,
                null,
                WebClient.builder(),
                "https://github.com/login/oauth",
                clientId,
                "client-secret",
                "http://localhost:5173/",
                secret);
    }

    @Test
    void connectStateRoundTripsForTheSameUser() {
        GithubOAuthService s = service("server-secret", "cid");
        String state = s.createState(GithubOAuthService.userSubject(7L));
        assertDoesNotThrow(() -> s.verifyState(state, GithubOAuthService.userSubject(7L)));
    }

    @Test
    void connectStateIsBoundToTheUser() {
        GithubOAuthService s = service("server-secret", "cid");
        String state = s.createState(GithubOAuthService.userSubject(7L));
        assertThrows(ApiException.class, () -> s.verifyState(state, GithubOAuthService.userSubject(8L)));
    }

    @Test
    void loginAndConnectStatesCannotBeSwapped() {
        GithubOAuthService s = service("server-secret", "cid");
        String login = s.createState(GithubOAuthService.LOGIN_SUBJECT);
        String connect = s.createState(GithubOAuthService.userSubject(7L));
        assertDoesNotThrow(() -> s.verifyLoginState(login));
        assertThrows(ApiException.class, () -> s.verifyLoginState(connect));
        assertThrows(ApiException.class, () -> s.verifyState(login, GithubOAuthService.userSubject(7L)));
    }

    @Test
    void tamperedOrForeignStateIsRejected() {
        String state = service("server-secret", "cid").createState(GithubOAuthService.LOGIN_SUBJECT);
        assertThrows(ApiException.class, () -> service("other-secret", "cid").verifyLoginState(state));
        assertThrows(ApiException.class, () -> service("server-secret", "cid").verifyLoginState(state + "x"));
        assertThrows(ApiException.class, () -> service("server-secret", "cid").verifyLoginState("garbage"));
        assertThrows(ApiException.class, () -> service("server-secret", "cid").verifyLoginState(null));
    }

    @Test
    void authorizeUrlsUseFrontendCallbackAndTheRightScopes() {
        GithubOAuthService s = service("server-secret", "my-client");
        String connect = s.start(3L);
        String login = s.startLogin();
        for (String url : new String[] {connect, login}) {
            assertTrue(url.startsWith("https://github.com/login/oauth/authorize?"));
            assertTrue(url.contains("client_id=my-client"));
            assertFalse(url.contains("redirect_uri"), "GitHub must use the app's registered callback URL");
            assertTrue(url.contains("state="));
        }
        assertTrue(connect.contains("scope=repo%20read:user&"));
        assertTrue(login.contains("scope=repo%20read:user%20user:email"), "login needs the verified email");
    }

    @Test
    void frontendCallbackIsDerivedFromTheFrontendUrl() {
        assertEquals(
                "http://localhost:5173/integrations/github/callback",
                service("s", "c").frontendCallback());
    }

    @Test
    void disabledWithoutCredentials() {
        GithubOAuthService s = service("server-secret", "");
        assertFalse(s.isEnabled());
        assertThrows(ApiException.class, () -> s.start(1L));
        assertThrows(ApiException.class, s::startLogin);
    }
}
