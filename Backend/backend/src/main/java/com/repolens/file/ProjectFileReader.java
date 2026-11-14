package com.repolens.file;

import com.repolens.common.ApiException;
import com.repolens.storage.StorageService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Reads a project's stored file from disk (storage/{userId}/{projectId}/{path}) with the zip-slip
 * guard. Callers must have checked project ownership already.
 */
@Component
public class ProjectFileReader {

    private final StorageService storageService;

    public ProjectFileReader(StorageService storageService) {
        this.storageService = storageService;
    }

    /** Content as UTF-8, or empty if the file is missing on disk. */
    public Optional<String> read(Long ownerId, RepoFile file) {
        Path baseDir = storageService.projectDir(ownerId, file.getProjectId());
        Path onDisk = storageService.resolveSafely(baseDir, file.getPath());
        if (!Files.isRegularFile(onDisk)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readString(onDisk, StandardCharsets.UTF_8));
        } catch (IOException e) {
            try {
                // Not valid UTF-8 (e.g. Latin-1 source): decode leniently instead of failing
                return Optional.of(new String(Files.readAllBytes(onDisk), StandardCharsets.UTF_8));
            } catch (IOException again) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read " + file.getPath());
            }
        }
    }
}
