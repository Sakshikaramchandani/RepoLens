package com.repolens.file;

import com.repolens.common.ApiException;
import com.repolens.language.Languages;
import com.repolens.project.ProjectDtos.FileContentResponse;
import com.repolens.project.ProjectDtos.FileNode;
import com.repolens.project.ProjectService;
import com.repolens.project.SourceType;
import com.repolens.storage.StorageService;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RepoFileService {

    /** Source, config and docs files of every language in {@link Languages}. Binaries, images, archives are dropped. */
    public static final Set<String> ALLOWED_EXTENSIONS = Languages.EXTENSIONS;

    /** In folders ke andar ki koi file nahi rakhenge (build output, dependencies, caches). */
    public static final Set<String> SKIPPED_DIRS = Set.of(
            "target",
            "build",
            "out",
            "dist",
            "node_modules",
            "bower_components",
            "vendor",
            "__pycache__",
            "venv",
            "site-packages",
            "Pods",
            "DerivedData",
            "obj",
            "coverage",
            ".git",
            ".idea",
            ".vscode",
            ".gradle",
            "__MACOSX");

    /** Generated lock files: huge, machine-written, useless for questions about the code. */
    public static final Set<String> SKIPPED_FILES = Set.of(
            "package-lock.json",
            "npm-shrinkwrap.json",
            "pnpm-lock.yaml",
            "composer.lock",
            "poetry.lock",
            "pipfile.lock",
            "go.sum",
            "cargo.lock",
            "gemfile.lock");

    private final RepoFileRepository repoFileRepository;
    private final ProjectService projectService;
    private final StorageService storageService;

    public RepoFileService(
            RepoFileRepository repoFileRepository, ProjectService projectService, StorageService storageService) {
        this.repoFileRepository = repoFileRepository;
        this.projectService = projectService;
        this.storageService = storageService;
    }

    // ---------- Registration (ZIP aur GitHub dono yahi use karte hain) ----------

    @Transactional
    public RepoFile register(Long projectId, String relativePath, long sizeBytes, SourceType source) {
        String path = relativePath.replace('\\', '/');
        String fileName = path.substring(path.lastIndexOf('/') + 1);
        return repoFileRepository.save(
                new RepoFile(projectId, path, fileName, extensionOf(fileName), sizeBytes, source));
    }

    @Transactional
    public void deleteAllForProject(Long projectId) {
        repoFileRepository.deleteByProjectId(projectId);
    }

    /** File rakhni hai ya nahi: skip folders mein na ho, hidden na ho, extension allowed ho */
    public static boolean isAllowed(String relativePath) {
        String[] parts = relativePath.replace('\\', '/').split("/");
        for (int i = 0; i < parts.length - 1; i++) {
            String dir = parts[i];
            if (SKIPPED_DIRS.contains(dir) || dir.startsWith(".")) {
                return false;
            }
        }
        String fileName = parts[parts.length - 1];
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (fileName.startsWith(".")
                || SKIPPED_FILES.contains(lower)
                || lower.endsWith(".min.js")
                || lower.endsWith(".min.css")
                || lower.endsWith(".bundle.js")) {
            return false;
        }
        return Languages.isKnown(fileName);
    }

    public static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase();
    }

    // ---------- File tree ----------

    @Transactional(readOnly = true)
    public List<FileNode> getTree(Long projectId, Long userId) {
        projectService.getOwnedProject(projectId, userId); // ownership check

        TreeBuilder root = new TreeBuilder("", "");
        for (RepoFile file : repoFileRepository.findByProjectIdOrderByPathAsc(projectId)) {
            String[] parts = file.getPath().split("/");
            TreeBuilder current = root;
            StringBuilder pathSoFar = new StringBuilder();

            for (int i = 0; i < parts.length; i++) {
                if (pathSoFar.length() > 0) pathSoFar.append('/');
                pathSoFar.append(parts[i]);
                final String childPath = pathSoFar.toString();

                TreeBuilder child =
                        current.children.computeIfAbsent(parts[i], name -> new TreeBuilder(name, childPath));

                if (i == parts.length - 1) {
                    child.fileId = file.getId(); // last part = file
                }
                current = child;
            }
        }
        return toFileNodes(root);
    }

    /** Folders pehle, phir files. Dono alphabetical (TreeMap ki wajah se) */
    private List<FileNode> toFileNodes(TreeBuilder parent) {
        List<FileNode> dirs = new ArrayList<>();
        List<FileNode> files = new ArrayList<>();
        for (TreeBuilder child : parent.children.values()) {
            if (child.fileId != null) {
                files.add(new FileNode(child.name, child.path, "FILE", child.fileId, null));
            } else {
                dirs.add(new FileNode(child.name, child.path, "DIR", null, toFileNodes(child)));
            }
        }
        dirs.addAll(files);
        return dirs;
    }

    private static final class TreeBuilder {
        final String name;
        final String path;
        Long fileId;
        final Map<String, TreeBuilder> children = new TreeMap<>();

        TreeBuilder(String name, String path) {
            this.name = name;
            this.path = path;
        }
    }

    // ---------- File content ----------

    @Transactional(readOnly = true)
    public FileContentResponse getContent(Long fileId, Long userId) {
        RepoFile file = repoFileRepository
                .findById(fileId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "File not found"));

        // Ownership check: file jis project ki hai, wo project is user ka hai?
        if (!projectService.isOwner(file.getProjectId(), userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "File not found");
        }

        Path baseDir = storageService.projectDir(userId, file.getProjectId());
        Path onDisk = storageService.resolveSafely(baseDir, file.getPath());

        if (!Files.exists(onDisk)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "File is missing on disk");
        }

        try {
            String content = new String(Files.readAllBytes(onDisk), StandardCharsets.UTF_8);
            return new FileContentResponse(file.getId(), file.getPath(), file.getExtension(), content);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
