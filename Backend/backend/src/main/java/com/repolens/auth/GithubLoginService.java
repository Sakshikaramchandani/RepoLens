package com.repolens.auth;

import com.repolens.auth.dto.AuthResponse;
import com.repolens.auth.dto.UserResponse;
import com.repolens.common.ApiException;
import com.repolens.github.GithubApiClient;
import com.repolens.github.GithubOAuthService;
import com.repolens.user.AvatarSource;
import com.repolens.user.ProfileService;
import com.repolens.user.User;
import com.repolens.user.UserRepository;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Continue with GitHub": sign in or sign up with a GitHub account, and connect it for repo access
 * in the same step.
 *
 * Which RepoLens account?
 *  1. the one this GitHub login was connected to before, else
 *  2. the account with the same VERIFIED primary email, else
 *  3. a new account (its password is random and unusable — it signs in with GitHub).
 */
@Service
public class GithubLoginService {

    private static final Logger log = LoggerFactory.getLogger(GithubLoginService.class);

    private final GithubOAuthService oauthService;
    private final GithubApiClient githubApiClient;
    private final UserRepository userRepository;
    private final OAuthAccounts accounts;
    private final JwtService jwtService;
    private final ProfileService profileService;

    public GithubLoginService(
            GithubOAuthService oauthService,
            GithubApiClient githubApiClient,
            UserRepository userRepository,
            OAuthAccounts accounts,
            JwtService jwtService,
            ProfileService profileService) {
        this.oauthService = oauthService;
        this.githubApiClient = githubApiClient;
        this.userRepository = userRepository;
        this.accounts = accounts;
        this.jwtService = jwtService;
        this.profileService = profileService;
    }

    public boolean isEnabled() {
        return oauthService.isEnabled();
    }

    public String startUrl() {
        return oauthService.startLogin();
    }

    @Transactional
    public AuthResponse complete(String code, String state) {
        oauthService.verifyLoginState(state);
        GithubOAuthService.TokenGrant grant = oauthService.exchangeCode(code);
        GithubApiClient.GithubUser githubUser = githubApiClient.getUser(grant.token());

        User user = oauthService
                .userIdForLogin(githubUser.login())
                .flatMap(userRepository::findById)
                .orElseGet(() -> findOrCreateByEmail(grant.token(), githubUser.login()));

        oauthService.saveConnection(user.getId(), grant, githubUser);
        profileService.applyProviderPicture(user, AvatarSource.GITHUB, githubUser.avatarUrl());
        log.info("GitHub sign-in: user={} login={}", user.getId(), githubUser.login());
        return new AuthResponse(jwtService.generateToken(user), UserResponse.from(user));
    }

    private User findOrCreateByEmail(String token, String githubLogin) {
        String email = githubApiClient
                .verifiedEmail(token)
                .map(e -> e.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(
                        () -> new ApiException(
                                HttpStatus.BAD_REQUEST,
                                "Your GitHub account has no verified email address. Verify one on GitHub, or sign up with email"));
        return accounts.findOrCreate(email, githubLogin, "GitHub");
    }
}
