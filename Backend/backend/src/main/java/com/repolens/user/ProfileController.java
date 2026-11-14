package com.repolens.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@Tag(name = "Profile")
public class ProfileController {

    public record UsernameRequest(@NotBlank String username) {}

    /** image = data URL of a PNG / JPEG / WebP, at most 512 KB once decoded. */
    public record AvatarUploadRequest(@NotBlank String image) {}

    public record AvatarSourceRequest(@NotNull AvatarSource source) {}

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/api/users/me")
    @Operation(summary = "Profile: username, picture and the GitHub / Google pictures you can switch to")
    public ProfileService.Profile me(@AuthenticationPrincipal User user) {
        return profileService.profile(user.getId());
    }

    @PatchMapping("/api/users/me")
    @Operation(summary = "Change username (unique, 3-30 letters, numbers, . _ -)")
    public ProfileService.Profile rename(
            @Valid @RequestBody UsernameRequest request, @AuthenticationPrincipal User user) {
        return profileService.changeUsername(user.getId(), request.username());
    }

    @PutMapping("/api/users/me/avatar")
    @Operation(summary = "Upload a profile picture (data URL)")
    public ProfileService.Profile upload(
            @Valid @RequestBody AvatarUploadRequest request, @AuthenticationPrincipal User user) {
        return profileService.uploadAvatar(user.getId(), request.image());
    }

    @PutMapping("/api/users/me/avatar/source")
    @Operation(summary = "Use the picture from GitHub or Google")
    public ProfileService.Profile useProvider(
            @Valid @RequestBody AvatarSourceRequest request, @AuthenticationPrincipal User user) {
        return profileService.useProviderAvatar(user.getId(), request.source());
    }

    @DeleteMapping("/api/users/me/avatar")
    @Operation(summary = "Remove the profile picture (initials are shown)")
    public ProfileService.Profile remove(@AuthenticationPrincipal User user) {
        return profileService.removeAvatar(user.getId());
    }

    /** Public: the token is random and changes on every upload. */
    @GetMapping("/api/avatars/{token}")
    @Operation(summary = "An uploaded profile picture (public, cacheable)")
    public ResponseEntity<byte[]> avatar(@PathVariable String token) {
        UserAvatar avatar = profileService.avatar(token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.getContentType()))
                .cacheControl(
                        CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(avatar.getData());
    }
}
