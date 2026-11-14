package com.repolens.auth;

import com.repolens.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Brute-force protection for the public auth endpoints (fixed-window counters, in memory).
 *
 * - every attempt counts against the client IP: login 20 / 15 min, register 5 / hour, OAuth 20 / 15 min
 * - failed logins also count against the email: 5 / 15 min, whatever IP they come from;
 *   a successful login clears that counter
 *
 * In memory = per server instance and reset on restart; behind a proxy, set
 * server.forward-headers-strategy so the real client IP is used.
 */
@Component
public class AuthRateLimiter {

    static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    static final int LOGIN_PER_IP = 20;
    static final int FAILED_LOGINS_PER_EMAIL = 5;
    static final Duration REGISTER_WINDOW = Duration.ofHours(1);
    static final int REGISTER_PER_IP = 5;
    static final Duration OAUTH_WINDOW = Duration.ofMinutes(15);
    static final int OAUTH_PER_IP = 20;
    private static final int PURGE_ABOVE = 10_000;

    private record Window(long startMillis, int count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    @Autowired
    public AuthRateLimiter() {
        this(Clock.systemUTC());
    }

    AuthRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public void checkLogin(String ip, String email) {
        hit("login-ip:" + ip, LOGIN_PER_IP, LOGIN_WINDOW);
        if (count("login-fail:" + key(email), LOGIN_WINDOW) >= FAILED_LOGINS_PER_EMAIL) {
            throw tooMany();
        }
    }

    public void loginFailed(String email) {
        increment("login-fail:" + key(email), LOGIN_WINDOW);
    }

    public void loginSucceeded(String email) {
        windows.remove("login-fail:" + key(email));
    }

    public void checkRegister(String ip) {
        hit("register-ip:" + ip, REGISTER_PER_IP, REGISTER_WINDOW);
    }

    public void checkOAuth(String ip) {
        hit("oauth-ip:" + ip, OAUTH_PER_IP, OAUTH_WINDOW);
    }

    // ------------------------------------------------------------------------------------------

    private void hit(String key, int limit, Duration window) {
        if (increment(key, window) > limit) {
            throw tooMany();
        }
    }

    private int increment(String key, Duration window) {
        purgeIfLarge();
        long now = clock.millis();
        return windows.compute(
                        key,
                        (k, w) -> w == null || expired(w, window, now)
                                ? new Window(now, 1)
                                : new Window(w.startMillis(), w.count() + 1))
                .count();
    }

    private int count(String key, Duration window) {
        Window w = windows.get(key);
        return w == null || expired(w, window, clock.millis()) ? 0 : w.count();
    }

    private static boolean expired(Window w, Duration window, long now) {
        return now - w.startMillis() >= window.toMillis();
    }

    /** Drops windows older than the longest limit so the map can't grow without bound. */
    private void purgeIfLarge() {
        if (windows.size() > PURGE_ABOVE) {
            long now = clock.millis();
            windows.values().removeIf(w -> now - w.startMillis() >= REGISTER_WINDOW.toMillis());
        }
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static ApiException tooMany() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Please wait a few minutes and try again");
    }
}
