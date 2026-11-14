package com.repolens.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * An uploaded profile picture (V9). Kept apart from {@link User} so the bytes are never loaded on
 * every authenticated request. Served publicly at /api/avatars/{token}; the random token changes on
 * every upload, so URLs can be cached forever.
 */
@Entity
@Table(name = "user_avatars")
public class UserAvatar {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Column(name = "content_type", nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false)
    private byte[] data;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected UserAvatar() {}

    public UserAvatar(Long userId) {
        this.userId = userId;
    }

    public void replace(String token, String contentType, byte[] data) {
        this.token = token;
        this.contentType = contentType;
        this.data = data;
        this.updatedAt = LocalDateTime.now();
    }

    public Long getUserId() {
        return userId;
    }

    public String getToken() {
        return token;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
