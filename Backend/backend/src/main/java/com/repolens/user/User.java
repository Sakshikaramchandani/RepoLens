package com.repolens.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password; // BCrypt hash, plain password kabhi nahi

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.USER;

    @Column(nullable = false, length = 30)
    private String username;

    /** External URL (GitHub/Google) or /api/avatars/{token} for an uploaded picture; null = initials. */
    @Column(name = "avatar_url", length = 1000)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "avatar_source", length = 20)
    private AvatarSource avatarSource;

    /** Last picture Google gave us, so the profile can offer "use my Google photo". */
    @Column(name = "google_avatar_url", length = 1000)
    private String googleAvatarUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** true once GitHub/Google proved the address; email + password sign-up never sets it. */
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    /** Tokens issued before this moment are rejected (null = none revoked). */
    @Column(name = "tokens_valid_after")
    private LocalDateTime tokensValidAfter;

    protected User() {
        // JPA ke liye zaroori
    }

    public User(String email, String password, Role role, String username) {
        this.email = email;
        this.password = password;
        this.role = role;
        this.username = username;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public Role getRole() {
        return role;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getUsername() {
        return username;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public AvatarSource getAvatarSource() {
        return avatarSource;
    }

    public String getGoogleAvatarUrl() {
        return googleAvatarUrl;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public LocalDateTime getTokensValidAfter() {
        return tokensValidAfter;
    }

    /** A provider proved the address belongs to this user. */
    public void markEmailVerified() {
        this.emailVerified = true;
    }

    public void setPassword(String passwordHash) {
        this.password = passwordHash;
    }

    /** Every token issued until now stops working. */
    public void revokeTokens() {
        this.tokensValidAfter = LocalDateTime.now();
    }

    public void setUsername(String username) {
        this.username = username;
    }

    /** source null = clear (initials) without remembering a choice. */
    public void setAvatar(String url, AvatarSource source) {
        this.avatarUrl = url;
        this.avatarSource = source;
    }

    public void setGoogleAvatarUrl(String googleAvatarUrl) {
        this.googleAvatarUrl = googleAvatarUrl;
    }
}
