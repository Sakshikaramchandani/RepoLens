package com.repolens.auth.dto;

import com.repolens.user.User;

/** avatarUrl: external (GitHub/Google), "/api/avatars/{token}" (uploaded, relative to the API), or null. */
public record UserResponse(Long id, String email, String role, String username, String avatarUrl) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(), user.getEmail(), user.getRole().name(), user.getUsername(), user.getAvatarUrl());
    }
}
