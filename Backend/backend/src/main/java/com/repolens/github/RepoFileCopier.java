package com.repolens.github;

import com.repolens.common.ApiException;
import com.repolens.file.RepoFileService;
import com.repolens.storage.StorageService;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Clone folder mein se sirf kaam ki files (Apoorv ke RepoFileService.isAllowed ke rules se)
 * target folder mein copy karta hai. .git/, target/, node_modules/ poore skip.
 * Symlinks bhi skip, taaki repo ka koi link server ki kisi aur file tak na pahunche.
 */
@Component
public class RepoFileCopier {

    public record CopyResult(Map<String, Long> files, int skipped) {}

    private final StorageService storageService;
    private final long maxFileBytes;
    private final long maxTotalBytes;

    public RepoFileCopier(
            StorageService storageService,
            @Value("${app.upload.max-file-bytes}") long maxFileBytes,
            @Value("${app.upload.max-total-bytes}") long maxTotalBytes) {
        this.storageService = storageService;
        this.maxFileBytes = maxFileBytes;
        this.maxTotalBytes = maxTotalBytes;
    }

    public CopyResult copyAllowedFiles(Path sourceDir, Path targetDir) throws IOException {
        Path source = sourceDir.toAbsolutePath().normalize();
        Path target = targetDir.toAbsolutePath().normalize();

        Map<String, Long> files = new LinkedHashMap<>();
        int[] skipped = {0};
        long[] totalBytes = {0};

        Files.walkFileTree(source, new SimpleFileVisitor<>() {

            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                if (dir.equals(source)) {
                    return FileVisitResult.CONTINUE;
                }
                String name = dir.getFileName().toString();
                if (RepoFileService.SKIPPED_DIRS.contains(name) || name.startsWith(".")) {
                    return FileVisitResult.SKIP_SUBTREE; // poora folder skip
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                if (!attrs.isRegularFile()) { // symlink wagairah
                    skipped[0]++;
                    return FileVisitResult.CONTINUE;
                }

                String relativePath = source.relativize(file).toString().replace('\\', '/');

                if (!RepoFileService.isAllowed(relativePath) || attrs.size() > maxFileBytes) {
                    skipped[0]++;
                    return FileVisitResult.CONTINUE;
                }

                totalBytes[0] += attrs.size();
                if (totalBytes[0] > maxTotalBytes) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Repository is too large after filtering");
                }

                Path dest = storageService.resolveSafely(target, relativePath);
                Files.createDirectories(dest.getParent());
                Files.copy(file, dest, StandardCopyOption.REPLACE_EXISTING);
                files.put(relativePath, attrs.size());
                return FileVisitResult.CONTINUE;
            }
        });

        return new CopyResult(files, skipped[0]);
    }
}
