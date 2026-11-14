package com.repolens.auth;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.user.ProfileService;
import com.repolens.user.Role;
import com.repolens.user.User;
import com.repolens.user.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class OAuthAccountsTest {

    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final ProfileService profiles = Mockito.mock(ProfileService.class);
    private final OAuthAccounts accounts = new OAuthAccounts(users, encoder, profiles);

    {
        Mockito.when(users.save(Mockito.any())).thenAnswer(inv -> inv.getArgument(0));
        Mockito.when(profiles.uniqueUsername(Mockito.any())).thenReturn("someone");
    }

    @Test
    void claimsAnUnverifiedAccount() {
        User squatted = new User("victim@x.com", encoder.encode("attacker-password"), Role.USER, "victim");
        Mockito.when(users.findByEmail("victim@x.com")).thenReturn(Optional.of(squatted));

        User user = accounts.findOrCreate("victim@x.com", "victim", "Google");

        assertSame(squatted, user);
        assertTrue(user.isEmailVerified());
        assertFalse(encoder.matches("attacker-password", user.getPassword()), "attacker's password must stop working");
        assertNotNull(user.getTokensValidAfter(), "attacker's sessions must be revoked");
    }

    @Test
    void leavesAVerifiedAccountAlone() {
        User owner = new User("me@x.com", encoder.encode("my-password"), Role.USER, "me");
        owner.markEmailVerified();
        Mockito.when(users.findByEmail("me@x.com")).thenReturn(Optional.of(owner));

        User user = accounts.findOrCreate("me@x.com", "me", "GitHub");

        assertTrue(encoder.matches("my-password", user.getPassword()));
        assertNull(user.getTokensValidAfter());
    }

    @Test
    void createsVerifiedAccounts() {
        Mockito.when(users.findByEmail("new@x.com")).thenReturn(Optional.empty());

        User user = accounts.findOrCreate("new@x.com", "new", "GitHub");

        assertTrue(user.isEmailVerified());
        assertEquals("new@x.com", user.getEmail());
    }

    @Test
    void revokedTokensAreRejectedButNewOnesWork() {
        User user = new User("a@x.com", "hash", Role.USER, "a");
        Instant before = Instant.now().minusSeconds(60);
        assertTrue(JwtService.issuedAfterRevocation(new JwtService.TokenClaims(1L, before), user));

        user.revokeTokens();

        assertFalse(JwtService.issuedAfterRevocation(new JwtService.TokenClaims(1L, before), user));
        assertTrue(JwtService.issuedAfterRevocation(new JwtService.TokenClaims(1L, Instant.now()), user));
    }
}
