package com.repolens.chunking;

import com.repolens.file.RepoFileService;
import com.repolens.language.Language;
import com.repolens.language.Languages;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Which of a project's files are worth embedding — for every supported language.
 *
 * Keep:  source code (Java, Python, TypeScript, Go, Rust, C#, ...), SQL, HTML/CSS,
 *        build + runtime config (pom.xml, package.json, Dockerfile, application.yml, *.tf ...), Markdown docs
 * Skip:  build/dependency folders and lock files (same rules as RepoFileService), test code in any
 *        language, generated code, JSON data files, very large or minified files
 *
 * Why: useless files waste embedding time and make the AI's answers worse.
 */
public final class IndexableFiles {

    private IndexableFiles() {}

    /** Larger files are almost always generated, minified or data. */
    public static final int MAX_INDEXED_CHARS = 400_000;

    /** JSON is mostly data; only these well-known config files are worth indexing. */
    private static final Set<String> JSON_CONFIG = Set.of(
            "package.json",
            "tsconfig.json",
            "jsconfig.json",
            "composer.json",
            "angular.json",
            "nest-cli.json",
            "vercel.json",
            "netlify.json",
            "firebase.json",
            "app.json",
            "deno.json",
            "turbo.json",
            "nx.json",
            "manifest.json",
            "launchsettings.json",
            "global.json",
            "openapi.json",
            "swagger.json");

    private static final Pattern JSON_CONFIG_PATTERN =
            Pattern.compile("^(tsconfig\\..+|appsettings(\\..+)?|\\.?eslintrc|babel\\.config|.*\\.schema)\\.json$");

    private static final Pattern TEST_DIR = Pattern.compile(
            "(^|/)(src/test|test|tests|__tests__|__mocks__|spec|specs|testdata|test_data|e2e|cypress|fixtures)/");

    private static final Pattern TEST_FILE =
            Pattern.compile("^(.*(Test|Tests|IT|TestCase|Spec)\\.(java|kt|scala|groovy|cs|swift|php)"
                    + "|.*_test\\.(go|py|rb|exs|dart|rs)"
                    + "|test_.*\\.py|conftest\\.py"
                    + "|.*\\.(test|spec)\\.(js|jsx|mjs|cjs|ts|tsx|mts|cts|vue|svelte)"
                    + "|.*_spec\\.rb"
                    + "|package-info\\.java|module-info\\.java)$");

    /** Generator naming conventions: sdk.gen.ts, user_pb2.py, api.pb.go, Model.generated.cs, schema.d.ts ... */
    private static final Pattern GENERATED_FILE = Pattern.compile(
            "^.*(\\.gen\\.[a-z]+|\\.generated\\.[a-z]+|_pb2(_grpc)?\\.pyi?|\\.pb(\\.gw)?\\.go|\\.pb\\.(h|cc)"
                    + "|_generated\\.[a-z]+|\\.g\\.dart|\\.freezed\\.dart|\\.designer\\.cs|routeTree\\.gen\\.ts)$",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern GENERATED_DIR = Pattern.compile("(^|/)(generated|generated-sources|__generated__)/");

    /** Decides by path only (cheap — call this before reading the file). */
    public static boolean isIndexable(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return false;
        }
        String path = relativePath.replace('\\', '/');
        if (!RepoFileService.isAllowed(path)) { // skipped folders, hidden files, lock files
            return false;
        }
        Optional<Language> language = Languages.detect(path);
        if (language.isEmpty()) {
            return false;
        }
        String lower = path.toLowerCase(Locale.ROOT);
        String fileName = path.substring(path.lastIndexOf('/') + 1);
        if (TEST_DIR.matcher(lower).find()
                || GENERATED_DIR.matcher(lower).find()
                || TEST_FILE.matcher(fileName).matches()
                || GENERATED_FILE.matcher(fileName).matches()) {
            return false;
        }
        if (language.get() == Language.JSON) {
            String name = fileName.toLowerCase(Locale.ROOT);
            return JSON_CONFIG.contains(name)
                    || JSON_CONFIG_PATTERN.matcher(name).matches();
        }
        return true;
    }

    /** Decides by content: generators mark their output; minified code has enormous lines. */
    public static boolean looksGenerated(String content) {
        if (content == null) {
            return false;
        }
        if (content.length() > MAX_INDEXED_CHARS) {
            return true;
        }
        String head = content.length() > 2000 ? content.substring(0, 2000) : content;
        String lower = head.toLowerCase(Locale.ROOT);
        if (head.contains("@Generated(")
                || head.contains("@javax.annotation.Generated")
                || head.contains("@jakarta.annotation.Generated")
                || head.contains("DO NOT EDIT")
                || lower.contains("automatically generated")
                || lower.contains("auto-generated")
                || lower.contains("autogenerated")
                || lower.contains("code generated by")
                || head.contains("@generated")) {
            return true;
        }
        return looksMinified(content);
    }

    /** Few lines, each very long → minified or bundled. */
    private static boolean looksMinified(String content) {
        if (content.length() < 5_000) {
            return false;
        }
        int lines = 1;
        for (int i = 0; i < content.length(); i++) {
            if (content.charAt(i) == '\n') {
                lines++;
            }
        }
        return content.length() / lines > 300;
    }
}
