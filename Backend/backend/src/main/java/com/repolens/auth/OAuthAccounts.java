package com.repolens.auth;

import com.repolens.user.ProfileService;
import com.repolens.user.Role;
import com.repolens.user.User;
import com.repolens.user.UserRepository;
import java.security.SecureRandom;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finds or creates the account for an email address that GitHub/Google has VERIFIED.
 *
 * Email + password sign-up does not prove the address, so anyone could register someone else's email
 * first and wait for the real owner to "Continue with Google" into an account whose password they know
 * (account pre-hijacking). When a provider proves the address for an unverified account, the account is
 * claimed: the password is replaced with an unusable one and every token issued before is revoked.
 */
@Service
public class OAuthAccounts {

    private static final Logger log = LoggerFactory.getLogger(OAuthAccounts.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProfileService profileService;

    public OAuthAccounts(
            UserRepository userRepository, PasswordEncoder passwordEncoder, ProfileService profileService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.profileService = profileService;
    }

    /**
     * @param verifiedEmail lower-cased address the provider marked as verified
     * @param usernameSeed  suggestion for a new account's username (provider login or email)
     */
    @Transactional
    public User findOrCreate(String verifiedEmail, String usernameSeed, String provider) {
        return userRepository
                .findByEmail(verifiedEmail)
                .map(user -> claimIfUnverified(user, provider))
                .orElseGet(() -> {
                    User created = new User(
                            verifiedEmail, unusablePassword(), Role.USER, profileService.uniqueUsername(usernameSeed));
                    created.markEmailVerified();
                    log.info("Creating account for {} user", provider);
                    return userRepository.save(created);
                });
    }

    private User claimIfUnverified(User user, String provider) {
        if (user.isEmailVerified()) {
            return user;
        }
        log.warn(
                "{} verified the email of unverified account {}: password reset and old sessions revoked",
                provider,
                user.getId());
        user.setPassword(unusablePassword());
        user.revokeTokens();
        user.markEmailVerified();
        return userRepository.save(user);
    }

    /** Random, never shown — this account signs in with its provider. BCrypt takes max 72 bytes. */
    private String unusablePassword() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return passwordEncoder.encode(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
    }
}
