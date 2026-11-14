package com.repolens.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.repolens.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
 * "Connect GitHub" (OAuth web flow).
 *
 * 1. start(): signed state = userId + expiry + nonce, HMAC-SHA256 with the server secret. The
 *    frontend sends the browser to GitHub with it.
 * 2. GitHub redirects to the FRONTEND callback route (the JWT lives in the browser, so the frontend
 *    must make the authenticated call). The frontend POSTs code + state here.
 * 3. complete(): verify state belongs to this user and is fresh, exchange the code for a token,
 *    store it encrypted. The token never goes to the browser.
 */
@Service
public class GithubOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GithubOAuthService.class);
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    /** Connect (already signed in): repo access. Login also needs the verified email. */
    private static final String CONNECT_SCOPES = "repo read:user";

    private static final String LOGIN_SCOPES = "repo read:user user:email";
    /** State subject for the "Continue with GitHub" sign-in (no RepoLens user yet). */
    static final String LOGIN_SUBJECT = "login";

    private static final int MAX_REPO_PAGES = 3;
    private static final SecureRandom RANDOM = new SecureRandom();

    public record ConnectionStatus(boolean enabled, boolean connected, String login, String avatarUrl, String scopes) {}

    /** An access token GitHub granted for an authorization code. */
    public record TokenGrant(String token, String scopes) {}

    private final GithubConnectionRepository repository;
    private final GithubApiClient githubApiClient;
    private final TokenEncryptor tokenEncryptor;
    private final WebClient oauthClient;
    private final String clientId;
    private final String clientSecret;
    private final String frontendCallback;
    private final String oauthUrl;
    private final byte[] stateKey;

    public GithubOAuthService(
            GithubConnectionRepository repository,
            GithubApiClient githubApiClient,
            TokenEncryptor tokenEncryptor,
            WebClient.Builder builder,
            @Value("${app.github.oauth-url}") String oauthUrl,
            @Value("${app.github.client-id:}") String clientId,
            @Value("${app.github.client-secret:}") String clientSecret,
            @Value("${app.frontend-url}") String frontendUrl,
            @Value("${app.jwt.secret}") String serverSecret) {
        this.repository = repository;
        this.githubApiClient = githubApiClient;
        this.tokenEncryptor = tokenEncryptor;
        this.oauthClient = builder.clone()
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.USER_AGENT, "RepoLens")
                .build();
        this.oauthUrl = oauthUrl;
        this.clientId = clientId == null ? "" : clientId.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
        this.frontendCallback = frontendUrl.replaceAll("/+$", "") + "/integrations/github/callback";
        this.stateKey = ("github-oauth-state:" + serverSecret).getBytes(StandardCharsets.UTF_8);
    }

    /** Where the frontend handles the OAuth result (also where the backend forwards stray callbacks). */
    public String frontendCallback() {
        return frontendCallback;
    }

    public boolean isEnabled() {
        return !clientId.isEmpty() && !clientSecret.isEmpty();
    }

    @Transactional(readOnly = true)
    public ConnectionStatus status(Long userId) {
        return repository
                .findByUserId(userId)
                .map(c -> new ConnectionStatus(isEnabled(), true, c.getGithubLogin(), c.getAvatarUrl(), c.getScopes()))
                .orElse(new ConnectionStatus(isEnabled(), false, null, null, null));
    }

    /** GitHub authorize URL to connect an account to this (signed-in) user. */
    public String start(Long userId) {
        return authorizeUrl(CONNECT_SCOPES, createState(userSubject(userId)));
    }

    /** GitHub authorize URL for "Continue with GitHub" (sign in or sign up). */
    public String startLogin() {
        return authorizeUrl(LOGIN_SCOPES, createState(LOGIN_SUBJECT));
    }

    private String authorizeUrl(String scopes, String state) {
        requireEnabled();
        // No redirect_uri on purpose: GitHub then uses the callback URL saved in the OAuth app, so a
        // small mismatch (127.0.0.1 vs localhost, another path) can never fail with "redirect_uri is
        // not associated with this application". Wherever it lands, the code + state are forwarded
        // to the frontend callback (see GithubCallbackForwarder and the frontend's OAuth forwarder).
        return UriComponentsBuilder.fromUriString(oauthUrl + "/authorize")
                .queryParam("client_id", clientId)
                .queryParam("scope", scopes)
                .queryParam("state", state)
                .queryParam("allow_signup", "true")
                .encode()
                .build()
                .toUriString();
    }

    @Transactional
    public ConnectionStatus complete(Long userId, String code, String state) {
        verifyState(state, userSubject(userId));
        TokenGrant grant = exchangeCode(code);
        saveConnection(userId, grant, githubApiClient.getUser(grant.token()));
        return status(userId);
    }

    /** Authorization code → access token (the code is single-use and expires in minutes). */
    public TokenGrant exchangeCode(String code) {
        requireEnabled();
        if (code == null || code.isBlank() || code.length() > 200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing authorization code from GitHub");
        }
        JsonNode tokenResponse;
        try {
            tokenResponse = oauthClient
                    .post()
                    .uri(oauthUrl + "/access_token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData("client_id", clientId)
                            .with("client_secret", clientSecret)
                            .with("code", code.trim()))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(TIMEOUT);
        } catch (RuntimeException e) {
            log.warn("GitHub token exchange failed: {}", e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub to finish signing in");
        }
        if (tokenResponse == null || !tokenResponse.hasNonNull("access_token")) {
            String reason = tokenResponse == null
                    ? "empty response"
                    : tokenResponse
                            .path("error_description")
                            .asText(tokenResponse.path("error").asText("unknown"));
            throw new ApiException(HttpStatus.BAD_REQUEST, "GitHub did not accept the sign-in: " + reason);
        }
        return new TokenGrant(
                tokenResponse.get("access_token").asText(),
                tokenResponse.path("scope").asText(""));
    }

    /** Store (or replace) the user's GitHub token, encrypted. */
    @Transactional
    public void saveConnection(Long userId, TokenGrant grant, GithubApiClient.GithubUser user) {
        GithubConnection connection = repository.findByUserId(userId).orElseGet(() -> new GithubConnection(userId));
        connection.connect(user.login(), user.avatarUrl(), tokenEncryptor.encrypt(grant.token()), grant.scopes());
        repository.save(connection);
        log.info("GitHub connected: user={} login={}", userId, user.login());
    }

    /** RepoLens user previously connected to this GitHub login, if any. */
    @Transactional(readOnly = true)
    public Optional<Long> userIdForLogin(String githubLogin) {
        return repository.findByGithubLoginIgnoreCase(githubLogin).map(GithubConnection::getUserId);
    }

    @Transactional
    public void disconnect(Long userId) {
        repository.deleteByUserId(userId);
    }

    /**
     * The user's GitHub token, if connected. A token that no longer decrypts (GITHUB_TOKEN_KEY was rotated)
     * counts as not connected: the user simply connects GitHub again, which stores a fresh one.
     */
    @Transactional(readOnly = true)
    public Optional<String> tokenFor(Long userId) {
        return repository.findByUserId(userId).flatMap(c -> {
            try {
                return Optional.of(tokenEncryptor.decrypt(c.getEncryptedToken()));
            } catch (IllegalStateException e) {
                log.warn("Stored GitHub token of user {} can't be decrypted (key rotated?); reconnect needed", userId);
                return Optional.empty();
            }
        });
    }

    /** Up to 300 most recently pushed repos the user can access; q filters by name/description. */
    @Transactional(readOnly = true)
    public List<GithubApiClient.RepoSummary> repos(Long userId, String query) {
        String token = tokenFor(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Connect your GitHub account first"));
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);

        List<GithubApiClient.RepoSummary> all = new ArrayList<>();
        for (int page = 1; page <= MAX_REPO_PAGES; page++) {
            List<GithubApiClient.RepoSummary> batch = githubApiClient.listRepos(token, page);
            all.addAll(batch);
            if (batch.size() < 100) {
                break;
            }
        }
        if (q.isEmpty()) {
            return all;
        }
        return all.stream()
                .filter(r -> r.fullName().toLowerCase(Locale.ROOT).contains(q)
                        || (r.description() != null
                                && r.description().toLowerCase(Locale.ROOT).contains(q)))
                .toList();
    }

    // ------------------------------------------------------------------ signed state

    /** For the sign-in flow (no RepoLens user yet). */
    public void verifyLoginState(String state) {
        verifyState(state, LOGIN_SUBJECT);
    }

    static String userSubject(Long userId) {
        return "u" + userId;
    }

    /** subject (u<id> or "login") + expiry + nonce, HMAC-signed with the server secret. */
    String createState(String subject) {
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        String payload = subject + ":" + Instant.now().plus(STATE_TTL).getEpochSecond() + ":"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
        String encoded =
                Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encoded + "." + sign(encoded);
    }

    /** The state must be ours (signature), for this purpose/user (subject), and fresh. */
    void verifyState(String state, String expectedSubject) {
        if (state == null || !state.contains(".")) {
            throw invalidState();
        }
        String[] parts = state.split("\\.", 2);
        if (!MessageDigest.isEqual(
                sign(parts[0]).getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8))) {
            throw invalidState();
        }
        String[] payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split(":");
        } catch (IllegalArgumentException e) {
            throw invalidState();
        }
        if (payload.length != 3 || !payload[0].equals(expectedSubject)) {
            throw invalidState();
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(payload[1]);
        } catch (NumberFormatException e) {
            throw invalidState();
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The GitHub sign-in took too long. Please try again");
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
        return new ApiException(HttpStatus.BAD_REQUEST, "Invalid GitHub sign-in state. Please start again");
    }

    private void requireEnabled() {
        if (!isEnabled()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "GitHub sign-in is not set up on this server (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)");
        }
    }
}
