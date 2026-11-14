package com.repolens.file;

import com.repolens.common.ApiException;
import com.repolens.history.FileHistoryService;
import com.repolens.history.GitHistoryAnalyzer;
import com.repolens.project.Project;
import com.repolens.project.ProjectDtos.UploadResponse;
import com.repolens.project.ProjectService;
import com.repolens.project.SourceType;
import com.repolens.storage.StorageService;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ZipUploadService {

    private final ProjectService projectService;
    private final RepoFileService repoFileService;
    private final StorageService storageService;
    private final FileHistoryService fileHistoryService;

    private final long maxZipBytes;
    private final long maxFileBytes;
    private final long maxTotalBytes;
    private final int maxEntries;

    public ZipUploadService(
            ProjectService projectService,
            RepoFileService repoFileService,
            StorageService storageService,
            FileHistoryService fileHistoryService,
            @Value("${app.upload.max-zip-bytes}") long maxZipBytes,
            @Value("${app.upload.max-file-bytes}") long maxFileBytes,
            @Value("${app.upload.max-total-bytes}") long maxTotalBytes,
            @Value("${app.upload.max-entries}") int maxEntries) {
        this.projectService = projectService;
        this.repoFileService = repoFileService;
        this.storageService = storageService;
        this.fileHistoryService = fileHistoryService;
        this.maxZipBytes = maxZipBytes;
        this.maxFileBytes = maxFileBytes;
        this.maxTotalBytes = maxTotalBytes;
        this.maxEntries = maxEntries;
    }

    /**
     * Flow:
     * 1. Ownership check
     * 2. ZIP validate (khaali nahi, .zip hai, size limit)
     * 3. TEMP folder mein extract (har entry par zip-slip check)
     * 4. Sab sahi raha toh temp folder ko storage/{userId}/{projectId} par move
     * 5. Purani RepoFile rows hatao, nayi register karo (+ git history agar ZIP mein .git tha)
     * Beech mein kuch bhi fail hua toh temp delete, purana project safe rehta hai.
     */
    @Transactional
    public UploadResponse upload(Long projectId, Long userId, MultipartFile zip) {
        Project project = projectService.getOwnedProject(projectId, userId);
        validateZip(zip);

        Path tempDir = storageService.createTempDir();
        Path gitDir = storageService.createTempDir(); // the ZIP's .git folder, if it has one
        Map<String, Long> extracted = new LinkedHashMap<>(); // path -> size
        GitHistoryAnalyzer.Result history;
        int skipped;

        try {
            ExtractResult result = extract(zip, tempDir, gitDir, extracted);
            skipped = result.skipped();
            // A ZIP of a git checkout keeps its history → churn + bug-fix counts for the risk map
            history = result.gitPrefix() == null
                    ? GitHistoryAnalyzer.Result.empty()
                    : fileHistoryService.read(gitDir, result.gitPrefix(), extracted.keySet());
            storageService.replaceProjectDir(userId, projectId, tempDir);
        } catch (IOException e) {
            storageService.deleteQuietly(tempDir);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read ZIP file. Is it a valid .zip?");
        } catch (RuntimeException e) {
            storageService.deleteQuietly(tempDir);
            throw e;
        } finally {
            storageService.deleteQuietly(gitDir);
        }

        // Re-upload = replace: purani rows hatao, nayi daalo
        repoFileService.deleteAllForProject(projectId);
        extracted.forEach((path, size) -> repoFileService.register(projectId, path, size, SourceType.ZIP));
        fileHistoryService.replace(projectId, history.files());
        project.setHistoryCommits(history.commitsRead());

        project.setSourceType(SourceType.ZIP);
        return new UploadResponse(extracted.size(), skipped);
    }

    private void validateZip(MultipartFile zip) {
        if (zip == null || zip.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please upload a non-empty .zip file");
        }
        String original = zip.getOriginalFilename();
        if (original == null || !original.toLowerCase().endsWith(".zip")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only .zip files are allowed");
        }
        if (zip.getSize() > maxZipBytes) {
            throw new ApiException(
                    HttpStatus.PAYLOAD_TOO_LARGE, "ZIP is larger than " + (maxZipBytes / 1024 / 1024) + " MB");
        }
    }

    /** skipped = kitni files skip hui; gitPrefix = folder holding .git ("" = ZIP root), null = no .git. */
    private record ExtractResult(int skipped, String gitPrefix) {}

    private ExtractResult extract(MultipartFile zip, Path tempDir, Path gitDir, Map<String, Long> out)
            throws IOException {
        int skipped = 0;
        int entries = 0;
        long totalBytes = 0;
        String gitPrefix = null;

        try (ZipInputStream zis = new ZipInputStream(zip.getInputStream())) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {

                if (++entries > maxEntries) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP has too many entries (max " + maxEntries + ")");
                }

                String name = entry.getName().replace('\\', '/');

                // ZIP-SLIP CHECK: har entry par, file likhne se PEHLE
                Path dest = storageService.resolveSafely(tempDir, name);

                if (entry.isDirectory()) {
                    continue;
                }

                String relativePath = tempDir.relativize(dest).toString().replace('\\', '/');

                // .git/ of the uploaded checkout → separate temp dir, only to read history
                int git = relativePath.startsWith(".git/") ? 0 : relativePath.indexOf("/.git/") + 1;
                if (git > 0 || relativePath.startsWith(".git/")) {
                    String prefix = relativePath.substring(0, git);
                    if (gitPrefix == null) {
                        gitPrefix = prefix;
                    }
                    if (prefix.equals(gitPrefix)) { // ignore nested repos (submodules)
                        Path gitDest = storageService.resolveSafely(gitDir, relativePath.substring(git + 5));
                        Files.createDirectories(gitDest.getParent());
                        long written = copyWithLimit(zis, gitDest, maxTotalBytes);
                        totalBytes += Math.max(0, written);
                        if (written < 0 || totalBytes > maxTotalBytes) {
                            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP is too large after extraction");
                        }
                    }
                    continue;
                }

                // Sirf code files, skip folders (target/, node_modules/...) nahi
                if (!RepoFileService.isAllowed(relativePath)) {
                    skipped++;
                    continue;
                }

                Files.createDirectories(dest.getParent());
                long written = copyWithLimit(zis, dest, maxFileBytes);
                if (written < 0) { // file 2MB se badi thi
                    skipped++;
                    continue;
                }

                // Zip bomb se bachav: chhoti ZIP extract hoke bahut badi na ban jaye
                totalBytes += written;
                if (totalBytes > maxTotalBytes) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP is too large after extraction");
                }

                out.put(relativePath, written);
            }
        }
        return new ExtractResult(skipped, gitPrefix);
    }

    /** File copy karo, limit cross hui toh file delete karke -1 return */
    private long copyWithLimit(InputStream in, Path dest, long limit) throws IOException {
        long written = 0;
        byte[] buffer = new byte[8192];
        int n;
        try (OutputStream os = Files.newOutputStream(dest)) {
            while ((n = in.read(buffer)) != -1) {
                written += n;
                if (written > limit) {
                    break;
                }
                os.write(buffer, 0, n);
            }
        }
        if (written > limit) {
            Files.deleteIfExists(dest);
            return -1;
        }
        return written;
    }
}
