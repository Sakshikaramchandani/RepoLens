package com.repolens.auth;

import com.repolens.auth.dto.AuthResponse;
import com.repolens.auth.dto.LoginRequest;
import com.repolens.auth.dto.RegisterRequest;
import com.repolens.auth.dto.UserResponse;
import com.repolens.common.ApiException;
import com.repolens.user.ProfileService;
import com.repolens.user.Role;
import com.repolens.user.User;
import com.repolens.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final ProfileService profileService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            ProfileService profileService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.profileService = profileService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalize(request.email());

        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
        }

        if (tooLongForBcrypt(request.password())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Password is too long (max 72 bytes)");
        }
        String hash = passwordEncoder.encode(request.password());
        User user = userRepository.save(new User(email, hash, Role.USER, profileService.uniqueUsername(email)));

        return new AuthResponse(jwtService.generateToken(user), UserResponse.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalize(request.email());

        // Email galat ho ya password, message same: attacker ko pata na chale kaunsa email exist karta hai
        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        // BCrypt 72 bytes se lamba password reject karta hai (exception) — aisa password kabhi save nahi hua, so it
        // can't match
        if (tooLongForBcrypt(request.password()) || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        return new AuthResponse(jwtService.generateToken(user), UserResponse.from(user));
    }

    @Transactional
    public void revokeSessions(Long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.revokeTokens();
            userRepository.save(user);
        });
    }

    /** BCrypt only accepts up to 72 bytes; @Size counts characters, so multi-byte input can still overflow. */
    private static boolean tooLongForBcrypt(String password) {
        return password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72;
    }

    private String normalize(String email) {
        return email.trim().toLowerCase();
    }
}
