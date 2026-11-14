package com.repolens.auth;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;

class GoogleLoginServiceTest {

    private static final String REDIRECT = "http://localhost:8080/login/oauth2/code/google";

    private GoogleLoginService service(String secret, String clientId, String clientSecret) {
        return new GoogleLoginService(
                null,
                null,
                null,
                null,
                WebClient.builder(),
                clientId,
                clientSecret,
                REDIRECT,
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                "https://openidconnect.googleapis.com/v1/userinfo",
                "http://localhost:5173/",
                secret);
    }

    private GoogleLoginService service() {
        return service("server-secret", "cid.apps.googleusercontent.com", "csecret");
    }

    @Test
    void stateRoundTrips() {
        GoogleLoginService s = service();
        String state = s.createState();
        assertDoesNotThrow(() -> s.verifyState(state));
    }

    @Test
    void tamperedOrForeignStateIsRejected() {
        String state = service().createState();
        assertThrows(
                ApiException.class, () -> service("other-secret", "cid", "cs").verifyState(state));
        assertThrows(ApiException.class, () -> service().verifyState(state + "x"));
        assertThrows(ApiException.class, () -> service().verifyState("garbage"));
        assertThrows(ApiException.class, () -> service().verifyState("a.b"));
        assertThrows(ApiException.class, () -> service().verifyState(null));
    }

    @Test
    void authorizeUrlCarriesRedirectUriScopesAndState() {
        String url = service().startUrl();
        assertTrue(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"));
        assertTrue(url.contains("client_id=cid.apps.googleusercontent.com"));
        // Google rejects the request unless redirect_uri exactly matches the registered one
        assertTrue(url.contains("redirect_uri=http://localhost:8080/login/oauth2/code/google"));
        assertTrue(url.contains("response_type=code"));
        assertTrue(url.contains("scope=openid%20email%20profile"));
        assertTrue(url.contains("state="));
    }

    @Test
    void disabledWithoutCredentials() {
        GoogleLoginService s = service("server-secret", "", "");
        assertFalse(s.isEnabled());
        ApiException e = assertThrows(ApiException.class, s::startUrl);
        assertEquals(503, e.getStatus().value());
    }

    @Test
    void forwarderPassesOnlyGoogleResultParamsToTheFrontend() {
        GoogleCallbackForwarder forwarder = new GoogleCallbackForwarder(service());
        ResponseEntity<Void> r = forwarder.forward("4/0Ab-code", "st.ate", null);
        assertEquals(302, r.getStatusCode().value());
        String location = r.getHeaders().getFirst(HttpHeaders.LOCATION);
        assertEquals("http://localhost:5173/auth/google/callback?code=4/0Ab-code&state=st.ate", location);

        String denied =
                forwarder.forward(null, "st", "access_denied").getHeaders().getFirst(HttpHeaders.LOCATION);
        assertEquals("http://localhost:5173/auth/google/callback?state=st&error=access_denied", denied);
    }
}
