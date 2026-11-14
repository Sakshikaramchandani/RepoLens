package com.repolens.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.repolens.auth.dto.AuthResponse;
import com.repolens.auth.dto.UserResponse;
import com.repolens.common.ApiException;
import com.repolens.user.AvatarSource;
import com.repolens.user.ProfileService;
import com.repolens.user.User;
import com.repolens.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * "Continue with Google" — same shape as the GitHub sign-in:
 *
 * 1. startUrl(): Google authorize URL with a signed, short-lived state (HMAC with the server secret).
 * 2. Google redirects to the backend redirect URI; GoogleCallbackForwarder sends code + state on to
 *    the frontend callback page, which POSTs them to /api/auth/google/callback.
 * 3. complete(): verify state, exchange the code, read the user's profile, then sign in the account
 *    with that VERIFIED email or create one (random unusable password — it signs in with Google).
 *    Google's tokens are not stored: sign-in is all we need them for.
 */
@Service
public class GoogleLoginService {

    private static final Logger log = LoggerFactory.getLogger(GoogleLoginService.class);
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    private static final String SCOPES = "openid email profile";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final OAuthAccounts accounts;
    private final JwtService jwtService;
    private final ProfileService profileService;
    private final WebClient http;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final String authUrl;
    private final String tokenUrl;
    private final String userinfoUrl;
    private final String frontendCallback;
    private final byte[] stateKey;

    public GoogleLoginService(
            UserRepository userRepository,
            OAuthAccounts accounts,
            JwtService jwtService,
            ProfileService profileService,
            WebClient.Builder builder,
            @Value("${app.google.client-id:}") String clientId,
            @Value("${app.google.client-secret:}") String clientSecret,
            @Value("${app.google.redirect-uri}") String redirectUri,
            @Value("${app.google.auth-url}") String authUrl,
            @Value("${app.google.token-url}") String tokenUrl,
            @Value("${app.google.userinfo-url}") String userinfoUrl,
            @Value("${app.frontend-url}") String frontendUrl,
            @Value("${app.jwt.secret}") String serverSecret) {
        this.userRepository = userRepository;
        this.accounts = accounts;
        this.jwtService = jwtService;
        this.profileService = profileService;
        this.http = builder.clone()
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.clientId = clientId == null ? "" : clientId.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
        this.redirectUri = redirectUri.trim();
        this.authUrl = authUrl;
        this.tokenUrl = tokenUrl;
        this.userinfoUrl = userinfoUrl;
        this.frontendCallback = frontendUrl.replaceAll("/+$", "") + "/auth/google/callback";
        // Different prefix than GitHub's: a GitHub state can never be replayed here and vice versa
        this.stateKey = ("google-oauth-state:" + serverSecret).getBytes(StandardCharsets.UTF_8);
    }

    public boolean isEnabled() {
        return !clientId.isEmpty() && !clientSecret.isEmpty();
    }

    /** Frontend page that finishes the sign-in (GoogleCallbackForwarder redirects here). */
    public String frontendCallback() {
        return frontendCallback;
    }

    public String startUrl() {
        requireEnabled();
        return UriComponentsBuilder.fromUriString(authUrl)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri) // Google requires it (unlike GitHub)
                .queryParam("response_type", "code")
                .queryParam("scope", SCOPES)
                .queryParam("state", createState())
                .queryParam("prompt", "select_account")
                .encode()
                .build()
                .toUriString();
    }

    @Transactional
    public AuthResponse complete(String code, String state) {
        requireEnabled();
        verifyState(state);
        if (code == null || code.isBlank() || code.length() > 512) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing authorization code from Google");
        }
        String accessToken = exchangeCode(code.trim());
        JsonNode profile = fetchProfile(accessToken);

        String email = profile.path("email").asText("").trim().toLowerCase(Locale.ROOT);
        if (email.isEmpty() || !profile.path("email_verified").asBoolean(false)) {
            // Unverified addresses are never used: they would let anyone claim someone else's account
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Your Google account has no verified email address. Sign up with email instead");
        }

        User user = accounts.findOrCreate(email, email, "Google");
        profileService.applyProviderPicture(
                user, AvatarSource.GOOGLE, profile.path("picture").asText(null));
        log.info("Google sign-in: user={}", user.getId());
        return new AuthResponse(jwtService.generateToken(user), UserResponse.from(user));
    }

    private String exchangeCode(String code) {
        JsonNode response;
        try {
            response = http.post()
                    .uri(tokenUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData("code", code)
                            .with("client_id", clientId)
                            .with("client_secret", clientSecret)
                            .with("redirect_uri", redirectUri)
                            .with("grant_type", "authorization_code"))
                    .exchangeToMono(r -> r.bodyToMono(JsonNode.class)) // Google puts errors in a 400 JSON body
                    .block(TIMEOUT);
        } catch (RuntimeException e) {
            log.warn("Google token exchange failed: {}", e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not reach Google to finish signing in");
        }
        if (response == null || !response.hasNonNull("access_token")) {
            String reason = response == null
                    ? "empty response"
                    : response.path("error_description")
                            .asText(response.path("error").asText("unknown"));
            log.warn("Google rejected the code: {}", reason);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Google did not accept the sign-in: " + reason);
        }
        return response.get("access_token").asText();
    }

    private JsonNode fetchProfile(String accessToken) {
        try {
            JsonNode profile = http.get()
                    .uri(userinfoUrl)
                    .headers(h -> h.setBearerAuth(accessToken))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(TIMEOUT);
            if (profile == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Empty profile from Google");
            }
            return profile;
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            log.warn("Google profile request failed: {}", e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not read your Google profile");
        }
    }

    // ------------------------------------------------------------------ signed state

    /** expiry + nonce, HMAC-signed — proves the callback answers a sign-in this server started. */
    String createState() {
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        String payload = Instant.now().plus(STATE_TTL).getEpochSecond() + ":"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
        String encoded =
                Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encoded + "." + sign(encoded);
    }

    void verifyState(String state) {
        if (state == null || !state.contains(".")) {
            throw invalidState();
        }
        String[] parts = state.split("\\.", 2);
        if (!MessageDigest.isEqual(
                sign(parts[0]).getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8))) {
            throw invalidState();
        }
        long expiresAt;
        try {
            String[] payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split(":");
            if (payload.length != 2) {
                throw invalidState();
            }
            expiresAt = Long.parseLong(payload[0]);
        } catch (IllegalArgumentException e) { // bad base64 or number
            throw invalidState();
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The Google sign-in took too long. Please try again");
        }
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(stateKey, "HmacSHA256"));
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    private static ApiException invalidState() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Invalid Google sign-in state. Please start again");
    }

    private void requireEnabled() {
        if (!isEnabled()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Google sign-in is not set up on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
        }
    }
}
