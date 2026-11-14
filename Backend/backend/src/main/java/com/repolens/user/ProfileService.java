package com.repolens.user;

import com.repolens.common.ApiException;
import com.repolens.github.GithubConnection;
import com.repolens.github.GithubConnectionRepository;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Username and profile picture.
 *
 * Pictures: imported from GitHub / Google when the user signs in with them (unless the user uploaded
 * their own or removed it), uploadable (PNG / JPEG / WebP, cropped in the browser), and switchable
 * back to a provider picture at any time.
 */
@Service
public class ProfileService {

    /** 3-30 chars, letters / digits / . _ -, starting with a letter or digit. */
    static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$");

    static final int MAX_AVATAR_BYTES = 512 * 1024;
    private static final Pattern DATA_URL =
            Pattern.compile("^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\\s]+)$");
    private static final SecureRandom RANDOM = new SecureRandom();

    public record ProviderAvatar(AvatarSource source, String url) {}

    public record Profile(
            Long id,
            String email,
            String role,
            String username,
            String avatarUrl,
            AvatarSource avatarSource,
            List<ProviderAvatar> providerAvatars) {}

    private final UserRepository userRepository;
    private final UserAvatarRepository avatarRepository;
    private final GithubConnectionRepository githubConnections;

    public ProfileService(
            UserRepository userRepository,
            UserAvatarRepository avatarRepository,
            GithubConnectionRepository githubConnections) {
        this.userRepository = userRepository;
        this.avatarRepository = avatarRepository;
        this.githubConnections = githubConnections;
    }

    @Transactional(readOnly = true)
    public Profile profile(Long userId) {
        return toProfile(load(userId));
    }

    @Transactional
    public Profile changeUsername(Long userId, String requested) {
        String username = requested == null ? "" : requested.strip();
        if (!USERNAME.matcher(username).matches()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Use 3-30 letters, numbers, dots, dashes or underscores, starting with a letter or number");
        }
        User user = load(userId);
        if (!username.equalsIgnoreCase(user.getUsername()) && userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ApiException(HttpStatus.CONFLICT, "That username is taken");
        }
        user.setUsername(username);
        return toProfile(userRepository.save(user));
    }

    /** dataUrl = "data:image/webp;base64,..." (the browser crops and resizes before sending). */
    @Transactional
    public Profile uploadAvatar(Long userId, String dataUrl) {
        Matcher m = DATA_URL.matcher(dataUrl == null ? "" : dataUrl.strip());
        if (!m.matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload a PNG, JPEG or WebP image");
        }
        byte[] bytes;
        try {
            bytes = Base64.getMimeDecoder().decode(m.group(2));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The image could not be read");
        }
        if (bytes.length > MAX_AVATAR_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "The image must be smaller than 512 KB");
        }
        String contentType = m.group(1);
        if (!magicBytesMatch(contentType, bytes)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The file is not a valid " + contentType + " image");
        }
        User user = load(userId);
        UserAvatar avatar = avatarRepository.findById(userId).orElseGet(() -> new UserAvatar(userId));
        byte[] token = new byte[16];
        RANDOM.nextBytes(token);
        avatar.replace(HexFormat.of().formatHex(token), contentType, bytes);
        avatarRepository.save(avatar);
        user.setAvatar("/api/avatars/" + avatar.getToken(), AvatarSource.UPLOAD);
        return toProfile(userRepository.save(user));
    }

    /** Switch to the GitHub or Google picture the account already has. */
    @Transactional
    public Profile useProviderAvatar(Long userId, AvatarSource source) {
        User user = load(userId);
        String url = providerAvatars(user).stream()
                .filter(p -> p.source() == source)
                .map(ProviderAvatar::url)
                .findFirst()
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "No " + source.name().charAt(0)
                                + source.name().substring(1).toLowerCase(Locale.ROOT)
                                + " picture is linked to this account"));
        avatarRepository.deleteById(userId);
        user.setAvatar(url, source);
        return toProfile(userRepository.save(user));
    }

    @Transactional
    public Profile removeAvatar(Long userId) {
        User user = load(userId);
        if (avatarRepository.existsById(userId)) {
            avatarRepository.deleteById(userId);
        }
        user.setAvatar(null, AvatarSource.NONE);
        return toProfile(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public UserAvatar avatar(String token) {
        return avatarRepository
                .findByToken(token)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Picture not found"));
    }

    /**
     * After a GitHub / Google sign-in or connect: remember the provider picture and use it unless
     * the user chose something else (uploaded one, picked the other provider, or removed it).
     */
    @Transactional
    public void applyProviderPicture(User user, AvatarSource source, String pictureUrl) {
        if (pictureUrl == null || pictureUrl.isBlank()) {
            return;
        }
        if (source == AvatarSource.GOOGLE) {
            user.setGoogleAvatarUrl(pictureUrl);
        }
        if (user.getAvatarSource() == null || user.getAvatarSource() == source) {
            user.setAvatar(pictureUrl, source);
        }
        userRepository.save(user);
    }

    @Transactional
    public void applyProviderPicture(Long userId, AvatarSource source, String pictureUrl) {
        applyProviderPicture(load(userId), source, pictureUrl);
    }

    /** A free username based on {@code preferred} (a GitHub login, an email's local part ...). */
    @Transactional(readOnly = true)
    public String uniqueUsername(String preferred) {
        String base = preferred == null ? "" : preferred.split("@")[0];
        base = base.replaceAll("[^A-Za-z0-9._-]", "").replaceAll("^[._-]+", "");
        if (base.length() > 24) {
            base = base.substring(0, 24);
        }
        if (base.length() < 3) {
            base = "user" + base;
        }
        if (!userRepository.existsByUsernameIgnoreCase(base)) {
            return base;
        }
        for (int i = 2; i < 1000; i++) {
            String candidate = base + i;
            if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
                return candidate;
            }
        }
        return base + "-" + (100_000 + RANDOM.nextInt(900_000));
    }

    // ------------------------------------------------------------------------------------------

    private User load(Long userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private List<ProviderAvatar> providerAvatars(User user) {
        List<ProviderAvatar> out = new ArrayList<>();
        githubConnections
                .findByUserId(user.getId())
                .map(GithubConnection::getAvatarUrl)
                .filter(url -> url != null && !url.isBlank())
                .ifPresent(url -> out.add(new ProviderAvatar(AvatarSource.GITHUB, url)));
        if (user.getGoogleAvatarUrl() != null && !user.getGoogleAvatarUrl().isBlank()) {
            out.add(new ProviderAvatar(AvatarSource.GOOGLE, user.getGoogleAvatarUrl()));
        }
        return out;
    }

    private Profile toProfile(User user) {
        return new Profile(
                user.getId(),
                user.getEmail(),
                user.getRole().name(),
                user.getUsername(),
                user.getAvatarUrl(),
                user.getAvatarSource(),
                providerAvatars(user));
    }

    static boolean magicBytesMatch(String contentType, byte[] b) {
        return switch (contentType) {
            case "image/png" -> b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
            case "image/jpeg" ->
                b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case "image/webp" ->
                b.length > 12
                        && b[0] == 'R'
                        && b[1] == 'I'
                        && b[2] == 'F'
                        && b[3] == 'F'
                        && b[8] == 'W'
                        && b[9] == 'E'
                        && b[10] == 'B'
                        && b[11] == 'P';
            default -> false;
        };
    }
}
