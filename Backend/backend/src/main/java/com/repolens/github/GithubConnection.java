package com.repolens.github;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** A user's OAuth-connected GitHub account (V7). */
@Entity
@Table(name = "github_connections")
public class GithubConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "github_login", nullable = false, length = 100)
    private String githubLogin;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "encrypted_token", nullable = false, columnDefinition = "TEXT")
    private String encryptedToken;

    @Column(length = 300)
    private String scopes;

    @Column(name = "connected_at", nullable = false)
    private LocalDateTime connectedAt;

    protected GithubConnection() {}

    public GithubConnection(Long userId) {
        this.userId = userId;
    }

    public void connect(String login, String avatarUrl, String encryptedToken, String scopes) {
        this.githubLogin = login;
        this.avatarUrl = avatarUrl;
        this.encryptedToken = encryptedToken;
        this.scopes = scopes;
        this.connectedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getGithubLogin() {
        return githubLogin;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getEncryptedToken() {
        return encryptedToken;
    }

    public String getScopes() {
        return scopes;
    }

    public LocalDateTime getConnectedAt() {
        return connectedAt;
    }
}
