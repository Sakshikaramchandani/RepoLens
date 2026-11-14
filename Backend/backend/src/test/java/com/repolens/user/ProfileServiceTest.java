package com.repolens.user;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.repolens.common.ApiException;
import com.repolens.github.GithubConnectionRepository;
import java.util.Base64;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ProfileServiceTest {

    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final GithubConnectionRepository github = mock(GithubConnectionRepository.class);
    private final ProfileService service = new ProfileService(users, avatars, github);

    private User user() {
        User u = new User("ana@x.dev", "hash", Role.USER, "ana");
        org.springframework.test.util.ReflectionTestUtils.setField(u, "id", 1L);
        when(users.findById(1L)).thenReturn(Optional.of(u));
        when(users.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(github.findByUserId(1L)).thenReturn(Optional.empty());
        return u;
    }

    @Test
    void usernameRulesAndUniqueness() {
        user();
        when(users.existsByUsernameIgnoreCase("Taken")).thenReturn(true);
        assertEquals("ana.dev-2", service.changeUsername(1L, " ana.dev-2 ").username());
        assertThrows(ApiException.class, () -> service.changeUsername(1L, "ab"));
        assertThrows(ApiException.class, () -> service.changeUsername(1L, "-ana"));
        assertThrows(ApiException.class, () -> service.changeUsername(1L, "ana smith"));
        ApiException taken = assertThrows(ApiException.class, () -> service.changeUsername(1L, "Taken"));
        assertEquals(409, taken.getStatus().value());
        assertEquals("ANA", service.changeUsername(1L, "ANA").username(), "changing case of your own name is fine");
    }

    @Test
    void uniqueUsernameFromEmailOrLogin() {
        when(users.existsByUsernameIgnoreCase(any())).thenReturn(false);
        when(users.existsByUsernameIgnoreCase("ana")).thenReturn(true);
        when(users.existsByUsernameIgnoreCase("ana2")).thenReturn(true);
        assertEquals("ana3", service.uniqueUsername("ana@x.dev"));
        assertEquals("octo-cat", service.uniqueUsername("octo-cat"));
        assertEquals("userjo", service.uniqueUsername("jo@x.dev"));
        assertEquals("first.last", service.uniqueUsername("first.last+tag@x.dev".replace("+tag", "")));
    }

    @Test
    void uploadValidatesTheImage() {
        user();
        when(avatars.findById(1L)).thenReturn(Optional.empty());
        when(avatars.save(any(UserAvatar.class))).thenAnswer(i -> i.getArgument(0));
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0};
        ProfileService.Profile p = service.uploadAvatar(
                1L, "data:image/png;base64," + Base64.getEncoder().encodeToString(png));
        assertEquals(AvatarSource.UPLOAD, p.avatarSource());
        assertTrue(p.avatarUrl().startsWith("/api/avatars/"));

        String fakePng = "data:image/png;base64," + Base64.getEncoder().encodeToString("<svg>".getBytes());
        assertThrows(ApiException.class, () -> service.uploadAvatar(1L, fakePng));
        assertThrows(ApiException.class, () -> service.uploadAvatar(1L, "data:image/svg+xml;base64,AAAA"));
        byte[] huge = new byte[ProfileService.MAX_AVATAR_BYTES + 1];
        huge[0] = (byte) 0x89;
        assertThrows(
                ApiException.class,
                () -> service.uploadAvatar(
                        1L, "data:image/png;base64," + Base64.getEncoder().encodeToString(huge)));
    }

    @Test
    void providerPictureOnlyReplacesWhatTheUserDidNotChoose() {
        User u = user();
        service.applyProviderPicture(u, AvatarSource.GITHUB, "https://gh/a.png");
        assertEquals("https://gh/a.png", u.getAvatarUrl());

        service.applyProviderPicture(u, AvatarSource.GOOGLE, "https://g/b.png");
        assertEquals("https://gh/a.png", u.getAvatarUrl(), "GitHub picture stays");
        assertEquals("https://g/b.png", u.getGoogleAvatarUrl(), "Google picture remembered");

        assertEquals(
                "https://g/b.png",
                service.useProviderAvatar(1L, AvatarSource.GOOGLE).avatarUrl());
        service.removeAvatar(1L);
        service.applyProviderPicture(u, AvatarSource.GOOGLE, "https://g/c.png");
        assertNull(u.getAvatarUrl(), "a removed picture is not brought back by a sign-in");
    }
}
