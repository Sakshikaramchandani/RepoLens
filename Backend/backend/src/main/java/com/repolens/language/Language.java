package com.repolens.language;

import java.util.List;

/**
 * Every file type RepoLens understands. One place decides, for each language: which files belong to
 * it, how its comments and strings look (for parsing), and what kind of file it is.
 *
 * Adding a language: add a constant here, then (optional) its definition patterns in
 * {@link Definitions} so chunks and risk metrics follow its functions and classes.
 */
public enum Language {

    // ---- code ----
    JAVA("Java", Kind.CODE, Syntax.C_LIKE, List.of("java"), List.of()),
    KOTLIN("Kotlin", Kind.CODE, Syntax.C_LIKE, List.of("kt", "kts"), List.of()),
    SCALA("Scala", Kind.CODE, Syntax.C_LIKE, List.of("scala", "sc"), List.of()),
    GROOVY("Groovy", Kind.CODE, Syntax.SCRIPT, List.of("groovy", "gradle"), List.of("Jenkinsfile")),
    CSHARP("C#", Kind.CODE, Syntax.C_LIKE, List.of("cs"), List.of()),
    C("C", Kind.CODE, Syntax.C_LIKE, List.of("c", "h"), List.of()),
    CPP("C++", Kind.CODE, Syntax.C_LIKE, List.of("cpp", "cc", "cxx", "hpp", "hh", "hxx", "ino"), List.of()),
    OBJECTIVE_C("Objective-C", Kind.CODE, Syntax.C_LIKE, List.of("m", "mm"), List.of()),
    GO("Go", Kind.CODE, Syntax.C_LIKE, List.of("go"), List.of()),
    RUST("Rust", Kind.CODE, Syntax.C_LIKE, List.of("rs"), List.of()),
    SWIFT("Swift", Kind.CODE, Syntax.C_LIKE, List.of("swift"), List.of()),
    DART("Dart", Kind.CODE, Syntax.SCRIPT, List.of("dart"), List.of()),
    JAVASCRIPT("JavaScript", Kind.CODE, Syntax.SCRIPT, List.of("js", "jsx", "mjs", "cjs"), List.of()),
    TYPESCRIPT("TypeScript", Kind.CODE, Syntax.SCRIPT, List.of("ts", "tsx", "mts", "cts"), List.of()),
    VUE("Vue", Kind.CODE, Syntax.SCRIPT, List.of("vue"), List.of()),
    SVELTE("Svelte", Kind.CODE, Syntax.SCRIPT, List.of("svelte"), List.of()),
    PHP("PHP", Kind.CODE, Syntax.SCRIPT, List.of("php"), List.of()),
    PYTHON("Python", Kind.CODE, Syntax.HASH, List.of("py", "pyi"), List.of()),
    RUBY("Ruby", Kind.CODE, Syntax.HASH, List.of("rb", "rake", "gemspec"), List.of("Gemfile", "Rakefile")),
    ELIXIR("Elixir", Kind.CODE, Syntax.HASH, List.of("ex", "exs"), List.of()),
    R("R", Kind.CODE, Syntax.HASH, List.of("r"), List.of()),
    LUA("Lua", Kind.CODE, Syntax.LUA, List.of("lua"), List.of()),
    SHELL("Shell", Kind.CODE, Syntax.HASH, List.of("sh", "bash", "zsh"), List.of()),
    POWERSHELL("PowerShell", Kind.CODE, Syntax.HASH, List.of("ps1", "psm1"), List.of()),
    SQL("SQL", Kind.QUERY, Syntax.SQL, List.of("sql"), List.of()),

    // ---- web markup / styles ----
    HTML("HTML", Kind.MARKUP, Syntax.MARKUP, List.of("html", "htm"), List.of()),
    CSS("CSS", Kind.MARKUP, Syntax.C_LIKE, List.of("css", "scss", "sass", "less"), List.of()),

    // ---- configuration / build ----
    XML("XML", Kind.CONFIG, Syntax.MARKUP, List.of("xml"), List.of()),
    YAML("YAML", Kind.CONFIG, Syntax.HASH, List.of("yml", "yaml"), List.of()),
    JSON("JSON", Kind.CONFIG, Syntax.NONE, List.of("json"), List.of()),
    TOML("TOML", Kind.CONFIG, Syntax.HASH, List.of("toml"), List.of()),
    PROPERTIES("Properties", Kind.CONFIG, Syntax.HASH, List.of("properties", "ini", "cfg"), List.of()),
    DOCKERFILE("Dockerfile", Kind.CONFIG, Syntax.HASH, List.of("dockerfile"), List.of("Dockerfile", "Containerfile")),
    MAKEFILE("Makefile", Kind.CONFIG, Syntax.HASH, List.of("mk"), List.of("Makefile", "makefile", "GNUmakefile")),
    TERRAFORM("Terraform", Kind.CONFIG, Syntax.HASH, List.of("tf", "tfvars", "hcl"), List.of()),
    PROTOBUF("Protocol Buffers", Kind.CONFIG, Syntax.C_LIKE, List.of("proto"), List.of()),
    GRAPHQL("GraphQL", Kind.CONFIG, Syntax.HASH, List.of("graphql", "gql"), List.of()),
    GO_MOD("Go modules", Kind.CONFIG, Syntax.C_LIKE, List.of("mod"), List.of()),
    REQUIREMENTS(
            "Requirements",
            Kind.CONFIG,
            Syntax.HASH,
            List.of(),
            List.of("requirements.txt", "requirements-dev.txt", "constraints.txt", "CMakeLists.txt", "Procfile")),

    // ---- docs ----
    MARKDOWN("Markdown", Kind.DOCS, Syntax.NONE, List.of("md", "mdx"), List.of()),
    RESTRUCTURED_TEXT("reStructuredText", Kind.DOCS, Syntax.NONE, List.of("rst", "adoc"), List.of());

    /** What a file is for — decides indexing, risk analysis and review defaults. */
    public enum Kind {
        /** Application code: indexed, risk-analysed, reviewable. */
        CODE,
        /** SQL: indexed and reviewable, but complexity metrics mean little. */
        QUERY,
        /** HTML / CSS: indexed and reviewable, no risk score. */
        MARKUP,
        /** Build and runtime configuration. */
        CONFIG,
        /** Documentation. */
        DOCS
    }

    /** Comment and string syntax, used to strip them before counting code structure. */
    public enum Syntax {
        /** // and block comments, "strings", 'c' char literals, `raw` strings (Java, C, Go, Rust...). */
        C_LIKE,
        /** Like C_LIKE, but '...' and `...` are full strings (JS, TS, PHP, Dart, Groovy). */
        SCRIPT,
        /** # comments, '...' and "..." strings, Python triple quotes. */
        HASH,
        /** -- and block comments, '...' strings. */
        SQL,
        /** -- comments, '...' and "..." strings. */
        LUA,
        /** HTML-style comments. */
        MARKUP,
        /** Nothing to strip. */
        NONE
    }

    private final String displayName;
    private final Kind kind;
    private final Syntax syntax;
    private final List<String> extensions;
    private final List<String> fileNames;

    Language(String displayName, Kind kind, Syntax syntax, List<String> extensions, List<String> fileNames) {
        this.displayName = displayName;
        this.kind = kind;
        this.syntax = syntax;
        this.extensions = extensions;
        this.fileNames = fileNames;
    }

    public String displayName() {
        return displayName;
    }

    public Kind kind() {
        return kind;
    }

    public Syntax syntax() {
        return syntax;
    }

    public List<String> extensions() {
        return extensions;
    }

    public List<String> fileNames() {
        return fileNames;
    }

    /** Languages whose blocks are delimited by braces (the rest use indentation or end keywords). */
    public boolean usesBraces() {
        return switch (this) {
            case PYTHON,
                    RUBY,
                    ELIXIR,
                    LUA,
                    SQL,
                    MARKDOWN,
                    RESTRUCTURED_TEXT,
                    YAML,
                    HTML,
                    XML,
                    PROPERTIES,
                    DOCKERFILE,
                    MAKEFILE,
                    REQUIREMENTS,
                    TOML -> false;
            default -> true;
        };
    }
}
