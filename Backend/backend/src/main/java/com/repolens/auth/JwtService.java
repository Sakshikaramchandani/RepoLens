package com.repolens.auth;

import com.repolens.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.expiration-ms}") long expirationMs) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expirationMs = expirationMs;
    }

    public String generateToken(User user) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(user.getId())) // token kiska hai
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key) // secret se sign
                .compact();
    }

    /** Verified token contents. */
    public record TokenClaims(Long userId, java.time.Instant issuedAt) {}

    // Signature ya expiry galat hui toh JwtException throw hogi
    public TokenClaims parse(String token) {
        Claims claims =
                Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        java.time.Instant issuedAt =
                claims.getIssuedAt() == null ? null : claims.getIssuedAt().toInstant();
        return new TokenClaims(Long.valueOf(claims.getSubject()), issuedAt);
    }

    /**
     * false when the user revoked their sessions (sign-out, account claimed) after this token was issued.
     * iat has whole-second precision, so a token issued in the same second as the revocation still counts
     * as issued after it — that is the token handed out by the request that revoked the old ones.
     */
    public static boolean issuedAfterRevocation(TokenClaims claims, User user) {
        if (user.getTokensValidAfter() == null) {
            return true;
        }
        if (claims.issuedAt() == null) {
            return false;
        }
        long revokedAt = user.getTokensValidAfter()
                .atZone(java.time.ZoneId.systemDefault())
                .toInstant()
                .getEpochSecond();
        return claims.issuedAt().getEpochSecond() >= revokedAt;
    }
}
