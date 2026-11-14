package com.repolens.auth;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AuthRateLimiterTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
    private final AuthRateLimiter limiter = new AuthRateLimiter(new Clock() {
        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    });

    @Test
    void blocksAnEmailAfterRepeatedFailuresFromAnyIp() {
        for (int i = 0; i < AuthRateLimiter.FAILED_LOGINS_PER_EMAIL; i++) {
            limiter.checkLogin("10.0.0." + i, "victim@x.com");
            limiter.loginFailed("Victim@X.com ");
        }
        ApiException e = assertThrows(ApiException.class, () -> limiter.checkLogin("10.9.9.9", "victim@x.com"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus());
        limiter.checkLogin("10.9.9.9", "someone-else@x.com"); // other accounts unaffected
    }

    @Test
    void successClearsFailuresAndWindowExpires() {
        for (int i = 0; i < AuthRateLimiter.FAILED_LOGINS_PER_EMAIL; i++) {
            limiter.loginFailed("a@x.com");
        }
        limiter.loginSucceeded("a@x.com");
        limiter.checkLogin("1.1.1.1", "a@x.com");

        for (int i = 0; i < AuthRateLimiter.FAILED_LOGINS_PER_EMAIL; i++) {
            limiter.loginFailed("b@x.com");
        }
        assertThrows(ApiException.class, () -> limiter.checkLogin("1.1.1.1", "b@x.com"));
        now.set(now.get().plus(AuthRateLimiter.LOGIN_WINDOW).plus(Duration.ofSeconds(1)));
        limiter.checkLogin("1.1.1.1", "b@x.com");
    }

    @Test
    void limitsRegistrationsPerIp() {
        for (int i = 0; i < AuthRateLimiter.REGISTER_PER_IP; i++) {
            limiter.checkRegister("2.2.2.2");
        }
        assertThrows(ApiException.class, () -> limiter.checkRegister("2.2.2.2"));
        limiter.checkRegister("3.3.3.3");
    }
}
