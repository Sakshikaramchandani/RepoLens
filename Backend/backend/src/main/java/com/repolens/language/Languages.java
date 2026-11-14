package com.repolens.language;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Path → {@link Language}. Exact file names (Dockerfile, Gemfile) win over extensions. */
public final class Languages {

    private static final Map<String, Language> BY_EXTENSION = new HashMap<>();
    private static final Map<String, Language> BY_FILE_NAME = new HashMap<>();

    static {
        for (Language language : Language.values()) {
            language.extensions().forEach(ext -> BY_EXTENSION.put(ext, language));
            language.fileNames().forEach(name -> BY_FILE_NAME.put(name.toLowerCase(Locale.ROOT), language));
        }
    }

    /** Every extension RepoLens keeps when importing (lower case, no dot). */
    public static final Set<String> EXTENSIONS = Collections.unmodifiableSet(new HashSet<>(BY_EXTENSION.keySet()));

    /** Extension-less (or special) file names RepoLens keeps, lower case. */
    public static final Set<String> FILE_NAMES = Collections.unmodifiableSet(new HashSet<>(BY_FILE_NAME.keySet()));

    private Languages() {}

    public static Optional<Language> detect(String path) {
        if (path == null || path.isBlank()) {
            return Optional.empty();
        }
        String fileName = fileName(path);
        String lower = fileName.toLowerCase(Locale.ROOT);
        Language byName = BY_FILE_NAME.get(lower);
        if (byName != null) {
            return Optional.of(byName);
        }
        // "Dockerfile.dev", "api.Dockerfile"
        if (lower.startsWith("dockerfile.") || lower.endsWith(".dockerfile")) {
            return Optional.of(Language.DOCKERFILE);
        }
        int dot = lower.lastIndexOf('.');
        return dot < 0 ? Optional.empty() : Optional.ofNullable(BY_EXTENSION.get(lower.substring(dot + 1)));
    }

    public static boolean isKnown(String path) {
        return detect(path).isPresent();
    }

    static String fileName(String path) {
        String normalized = path.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1);
    }
}
