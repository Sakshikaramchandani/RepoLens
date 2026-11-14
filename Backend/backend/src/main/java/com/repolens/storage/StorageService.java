package com.repolens.storage;

import com.repolens.common.ApiException;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private final Path root;
    private final Path tempRoot;

    public StorageService(@Value("${app.storage.root}") String rootDir) throws IOException {
        this.root = Paths.get(rootDir).toAbsolutePath().normalize();
        this.tempRoot = root.resolve(".tmp");
        Files.createDirectories(tempRoot);
        log.info("Storage root: {}", root);
    }

    /** storage/{userId}/{projectId} */
    public Path projectDir(Long userId, Long projectId) {
        return root.resolve(String.valueOf(userId))
                .resolve(String.valueOf(projectId))
                .normalize();
    }

    /**
     * ZIP-SLIP CHECK.
     * relativePath ko baseDir ke andar resolve karo. Agar "../../" ya absolute path
     * ki wajah se result baseDir ke BAHAR chala gaya, toh reject.
     */
    public Path resolveSafely(Path baseDir, String relativePath) {
        Path resolved = baseDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsafe path rejected (zip-slip): " + relativePath);
        }
        return resolved;
    }

    /** Upload pehle temp folder mein extract hota hai, sab sahi raha tabhi asli jagah jaata hai */
    public Path createTempDir() {
        try {
            return Files.createTempDirectory(tempRoot, "upload-");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Purana project folder hatao, naya (temp) folder uski jagah rakho */
    public void replaceProjectDir(Long userId, Long projectId, Path newContent) throws IOException {
        Path target = projectDir(userId, projectId);
        deleteQuietly(target);
        Files.createDirectories(target.getParent());
        Files.move(newContent, target);
    }

    public void deleteProjectDir(Long userId, Long projectId) {
        deleteQuietly(projectDir(userId, projectId));
    }

    public void deleteQuietly(Path path) {
        try {
            FileSystemUtils.deleteRecursively(path);
        } catch (IOException e) {
            log.warn("Could not delete {}", path, e);
        }
    }
}
