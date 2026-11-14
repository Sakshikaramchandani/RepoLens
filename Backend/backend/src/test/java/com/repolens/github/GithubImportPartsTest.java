package com.repolens.github;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.common.ApiException;
import com.repolens.storage.StorageService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Bina Spring, bina DB, bina internet chalne wale tests */
class GithubImportPartsTest {

    private static final String TEST_KEY = Base64.getEncoder().encodeToString(new byte[32]);

    // ---------- GithubRepoRef ----------

    @Test
    void parsesNormalUrl() {
        GithubRepoRef ref = GithubRepoRef.parse("https://github.com/spring-projects/spring-petclinic");
        assertEquals("spring-projects", ref.owner());
        assertEquals("spring-petclinic", ref.repo());
    }

    @Test
    void parsesUrlWithGitSuffixAndTrailingSlash() {
        assertEquals(
                "demo",
                GithubRepoRef.parse("https://github.com/apoorv/demo.git").repo());
        assertEquals(
                "demo", GithubRepoRef.parse("https://github.com/apoorv/demo/").repo());
        assertEquals(
                "my.repo",
                GithubRepoRef.parse("https://github.com/apoorv/my.repo").repo());
    }

    @Test
    void rejectsNonGithubUrl() {
        assertThrows(ApiException.class, () -> GithubRepoRef.parse("https://gitlab.com/a/b"));
        assertThrows(ApiException.class, () -> GithubRepoRef.parse("not a url"));
        assertThrows(ApiException.class, () -> GithubRepoRef.parse(""));
    }

    // ---------- TokenEncryptor ----------

    @Test
    void tokenEncryptDecryptRoundTrip() {
        TokenEncryptor encryptor = new TokenEncryptor(TEST_KEY);
        String token = "ghp_exampleSecretToken123";

        String encrypted = encryptor.encrypt(token);

        assertNotEquals(token, encrypted); // plain token nahi dikhna chahiye
        assertEquals(token, encryptor.decrypt(encrypted)); // wapas same milna chahiye
        assertNotEquals(encrypted, encryptor.encrypt(token)); // random IV: har baar alag output
    }

    @Test
    void rejectsWrongKeyLength() {
        String shortKey = Base64.getEncoder().encodeToString(new byte[16]);
        assertThrows(IllegalStateException.class, () -> new TokenEncryptor(shortKey));
    }

    // ---------- RepoFileCopier ----------

    @Test
    void copierKeepsOnlyAllowedCodeFiles(@TempDir Path tmp) throws IOException {
        Path repo = tmp.resolve("repo");
        write(repo, "src/main/java/com/demo/App.java", "class App {}");
        write(repo, "pom.xml", "<project/>");
        write(repo, "target/classes/Old.java", "class Old {}"); // skip folder
        write(repo, ".git/config", "[core]"); // hidden folder
        write(repo, "logo.png", "not-really-an-image"); // extension allowed nahi

        Path out = tmp.resolve("out");
        Files.createDirectories(out);

        StorageService storage = new StorageService(tmp.resolve("storage").toString());
        RepoFileCopier copier = new RepoFileCopier(storage, 2_000_000L, 200_000_000L);

        RepoFileCopier.CopyResult result = copier.copyAllowedFiles(repo, out);

        assertEquals(
                Set.of("src/main/java/com/demo/App.java", "pom.xml"),
                result.files().keySet());
        assertEquals(1, result.skipped()); // sirf logo.png gina gaya (target/ aur .git/ poore folder skip)
        assertTrue(Files.exists(out.resolve("src/main/java/com/demo/App.java")));
        assertFalse(Files.exists(out.resolve("target")));
        assertFalse(Files.exists(out.resolve(".git")));
    }

    private static void write(Path root, String relative, String content) throws IOException {
        Path file = root.resolve(relative);
        Files.createDirectories(file.getParent());
        Files.writeString(file, content);
    }
}
