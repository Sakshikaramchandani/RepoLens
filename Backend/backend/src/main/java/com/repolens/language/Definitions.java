package com.repolens.language;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds the functions, types and (for Markdown) sections in a source file of any supported language,
 * with their line ranges. Pattern-based and tolerant: it never throws on odd code, it just finds less.
 *
 * Used by the chunker (one chunk per function/type, never cut in the middle) and by the risk
 * analyzer (complexity, length, nesting and parameters per function).
 */
public final class Definitions {

    public enum Kind {
        /** class, struct, interface, enum, module, impl, message ... */
        TYPE,
        /** function, method, constructor */
        FUNCTION,
        /** Markdown heading */
        SECTION
    }

    /**
     * startLine includes leading comments / decorators; declLine is the signature line (1-based).
     * parent = enclosing type name, or null. maxNesting = deepest block nesting inside the body.
     */
    public record Definition(
            Kind kind,
            String name,
            int startLine,
            int declLine,
            int endLine,
            int indent,
            int params,
            String parent,
            boolean insideFunction,
            int maxNesting) {

        public int lines() {
            return endLine - startLine + 1;
        }
    }

    /** A source file split into lines, plus the same lines with comments and strings blanked. */
    public record Source(Language language, String[] lines, String[] code) {

        public static Source of(Language language, String content) {
            String text = content == null ? "" : content;
            String[] lines = text.split("\r?\n", -1);
            String[] code = CodeText.strip(text, language.syntax()).split("\r?\n", -1);
            if (code.length != lines.length) { // should not happen; never index out of bounds
                code = lines;
            }
            return new Source(language, lines, code);
        }
    }

    private record Rule(Kind kind, Pattern pattern) {}

    private static final Set<String> NOT_NAMES = Set.of(
            "if",
            "for",
            "while",
            "switch",
            "catch",
            "return",
            "new",
            "else",
            "throw",
            "throws",
            "await",
            "yield",
            "do",
            "try",
            "using",
            "lock",
            "sizeof",
            "typeof",
            "case",
            "delete",
            "function",
            "foreach",
            "synchronized",
            "when",
            "super",
            "this",
            "elif",
            "defined",
            "assert",
            "print",
            "not",
            "and",
            "or",
            "in",
            "is",
            "match",
            "guard",
            "defer",
            "go",
            "select",
            "goto",
            "static_assert",
            "decltype",
            "alignof",
            "constructor_",
            "import",
            "export",
            "from",
            "with",
            "except",
            "finally",
            "loop");

    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s");

    private static final Map<Language, List<Rule>> RULES = new EnumMap<>(Language.class);

    static {
        String attrs = "(?:\\[[^\\]]*\\]\\s*|@[\\w.]+(?:\\([^)]*\\))?\\s*)*";
        String mods = "(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|sealed|extern"
                + "|unsafe|new|partial|readonly|final|synchronized|native|default|transient|inline|const|constexpr"
                + "|explicit|friend|external|factory|operator)\\s+)*";
        Rule cType = new Rule(
                Kind.TYPE,
                Pattern.compile("^\\s*" + attrs
                        + "(?:(?:public|private|protected|internal|static|abstract|final|sealed|partial|readonly|open|data"
                        + "|inner|value|export|default|declare|template\\s*<[^>]*>)\\s+)*"
                        + "(?:enum\\s+class|class|interface|struct|enum|record|union|trait|object|protocol|extension|actor"
                        + "|namespace|mixin)\\s+(?<n>[A-Za-z_]\\w*)(?!\\s*;)(?!\\s+[*&]*\\w+\\s*\\()"));
        Rule cMethod = new Rule(
                Kind.FUNCTION,
                Pattern.compile("^\\s*" + attrs + mods
                        + "(?:<[^>]+>\\s+)?(?<ret>(?:[\\w<>\\[\\],.?:]+\\s+)*?[\\w<>\\[\\],.?:]+(?:\\s*<[^>]*>)?)"
                        + "\\s+[*&]*\\s*(?<n>[A-Za-z_~][\\w:~]*)"
                        + "\\s*\\([^;]*$"));
        Rule cConstructor = new Rule(
                Kind.FUNCTION,
                Pattern.compile("^\\s*" + attrs
                        + "(?:public|private|protected|internal)\\s+(?:static\\s+)?(?<n>[A-Z]\\w*)\\s*\\([^;]*$"));

        List<Rule> cLike = List.of(cType, cConstructor, cMethod);
        for (Language l : List.of(
                Language.JAVA, Language.CSHARP, Language.C, Language.CPP, Language.OBJECTIVE_C, Language.DART)) {
            RULES.put(l, cLike);
        }

        RULES.put(
                Language.KOTLIN,
                List.of(
                        cType,
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile(
                                        "^\\s*" + attrs
                                                + "(?:(?:public|private|protected|internal|override|open|abstract|suspend|inline|operator|infix"
                                                + "|tailrec|external|final)\\s+)*fun\\s+(?:<[^>]+>\\s*)?(?:[\\w.<>?]+\\.)?(?<n>\\w+)\\s*\\("))));

        RULES.put(
                Language.SCALA,
                List.of(
                        cType,
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile(
                                        "^\\s*(?:(?:override|private|protected|final|implicit|lazy)\\s+)*def\\s+(?<n>\\w+)"))));

        RULES.put(
                Language.GROOVY,
                List.of(
                        cType,
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile(
                                        "^\\s*(?:(?:public|private|protected|static)\\s+)*def\\s+(?<n>\\w+)\\s*\\(")),
                        cMethod));

        RULES.put(
                Language.GO,
                List.of(
                        new Rule(Kind.TYPE, Pattern.compile("^type\\s+(?<n>\\w+)\\s+(?:struct|interface)\\b")),
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile(
                                        "^func\\s+(?:\\([^)]*\\)\\s*)?(?<n>\\w+)\\s*(?:\\[[^\\]]*\\])?\\s*\\("))));

        String rustVis = "(?:pub(?:\\([^)]*\\))?\\s+)?";
        RULES.put(
                Language.RUST,
                List.of(
                        new Rule(
                                Kind.TYPE,
                                Pattern.compile("^\\s*" + rustVis + "(?:struct|enum|trait|union|mod)\\s+(?<n>\\w+)")),
                        new Rule(
                                Kind.TYPE,
                                Pattern.compile(
                                        "^\\s*impl(?:\\s*<[^>]*>)?\\s+(?:[\\w:<>&' ]+?\\s+for\\s+)?(?<n>[\\w:]+)")),
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile("^\\s*" + rustVis
                                        + "(?:(?:const|async|unsafe|extern\\s+\"[^\"]*\")\\s+)*fn\\s+(?<n>\\w+)"))));

        RULES.put(
                Language.SWIFT,
                List.of(
                        cType,
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile("^\\s*" + attrs
                                        + "(?:(?:public|private|fileprivate|internal|open|static|class|final|override|mutating"
                                        + "|nonmutating|convenience|required|async)\\s+)*func\\s+(?<n>\\w+)")),
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile("^\\s*(?:(?:public|private|fileprivate|internal|override"
                                        + "|convenience|required)\\s+)*(?<n>init)\\s*\\??\\("))));

        List<Rule> script = List.of(
                new Rule(
                        Kind.TYPE,
                        Pattern.compile("^\\s*(?:export\\s+)?(?:default\\s+)?(?:declare\\s+)?"
                                + "(?:abstract\\s+)?(?:class|interface|enum)\\s+(?<n>[A-Za-z_$][\\w$]*)")),
                new Rule(
                        Kind.TYPE,
                        Pattern.compile(
                                "^\\s*(?:export\\s+)?(?:declare\\s+)?type\\s+(?<n>[A-Za-z_$][\\w$]*)\\s*(?:<[^>]*>)?\\s*=")),
                new Rule(
                        Kind.FUNCTION,
                        Pattern.compile("^\\s*(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?"
                                + "function\\s*\\*?\\s*(?<n>[A-Za-z_$][\\w$]*)")),
                new Rule(
                        Kind.FUNCTION,
                        Pattern.compile("^\\s*(?:export\\s+)?(?:const|let|var)\\s+(?<n>[A-Za-z_$][\\w$]*)"
                                + "\\s*(?::[^=]+)?=\\s*(?:async\\s+)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)")),
                new Rule(
                        Kind.FUNCTION,
                        Pattern.compile("^\\s+(?:(?:public|private|protected|static|readonly|async"
                                + "|override|abstract|get|set)\\s+)*(?<n>[A-Za-z_$][\\w$]*)\\s*(?:<[^>]*>)?\\s*\\([^)]*\\)?"
                                + "\\s*(?::\\s*[^{=]+)?\\{\\s*$")));
        List<Rule> sfc = new ArrayList<>(script);
        sfc.add(0, new Rule(Kind.TYPE, Pattern.compile("^<(?<n>template|script|style)\\b")));
        RULES.put(Language.JAVASCRIPT, script);
        RULES.put(Language.TYPESCRIPT, script);
        RULES.put(Language.VUE, sfc);
        RULES.put(Language.SVELTE, sfc);

        RULES.put(
                Language.PHP,
                List.of(
                        new Rule(
                                Kind.TYPE,
                                Pattern.compile(
                                        "^\\s*(?:abstract\\s+|final\\s+|readonly\\s+)*(?:class|interface|trait|enum)\\s+(?<n>\\w+)")),
                        new Rule(
                                Kind.FUNCTION,
                                Pattern.compile("^\\s*(?:(?:public|private|protected|static|abstract|final)\\s+)*"
                                        + "function\\s+&?(?<n>\\w+)"))));

        RULES.put(
                Language.PYTHON,
                List.of(
                        new Rule(Kind.TYPE, Pattern.compile("^\\s*class\\s+(?<n>\\w+)")),
                        new Rule(Kind.FUNCTION, Pattern.compile("^\\s*(?:async\\s+)?def\\s+(?<n>\\w+)"))));

        RULES.put(
                Language.RUBY,
                List.of(
                        new Rule(Kind.TYPE, Pattern.compile("^\\s*(?:class|module)\\s+(?<n>[\\w:]+)")),
                        new Rule(Kind.FUNCTION, Pattern.compile("^\\s*def\\s+(?:self\\.)?(?<n>[\\w?!=\\[\\]]+)"))));

        RULES.put(
                Language.ELIXIR,
                List.of(
                        new Rule(Kind.TYPE, Pattern.compile("^\\s*defmodule\\s+(?<n>[\\w.]+)")),
                        new Rule(Kind.FUNCTION, Pattern.compile("^\\s*defp?\\s+(?<n>[\\w?!]+)"))));

        RULES.put(
                Language.LUA,
                List.of(new Rule(Kind.FUNCTION, Pattern.compile("^\\s*(?:local\\s+)?function\\s+(?<n>[\\w.:]+)"))));

        RULES.put(
                Language.R,
                List.of(new Rule(Kind.FUNCTION, Pattern.compile("^\\s*(?<n>[\\w.]+)\\s*(?:<-|=)\\s*function\\s*\\("))));

        RULES.put(
                Language.SHELL,
                List.of(
                        new Rule(Kind.FUNCTION, Pattern.compile("^\\s*function\\s+(?<n>[\\w:-]+)")),
                        new Rule(Kind.FUNCTION, Pattern.compile("^\\s*(?<n>[\\w:-]+)\\s*\\(\\)\\s*\\{?"))));

        RULES.put(
                Language.POWERSHELL,
                List.of(new Rule(Kind.FUNCTION, Pattern.compile("(?i)^\\s*function\\s+(?<n>[\\w-]+)"))));

        RULES.put(
                Language.SQL,
                List.of(new Rule(
                        Kind.TYPE,
                        Pattern.compile(
                                "(?i)^\\s*create\\s+(?:or\\s+replace\\s+)?(?:temp(?:orary)?\\s+)?(?:unique\\s+)?"
                                        + "(?:table|view|materialized\\s+view|function|procedure|trigger|index|type|sequence)\\s+"
                                        + "(?:if\\s+not\\s+exists\\s+)?(?<n>[\\w.\"`\\[\\]]+)"))));

        RULES.put(
                Language.PROTOBUF,
                List.of(
                        new Rule(Kind.TYPE, Pattern.compile("^\\s*(?:message|service|enum)\\s+(?<n>\\w+)")),
                        new Rule(Kind.FUNCTION, Pattern.compile("^\\s*rpc\\s+(?<n>\\w+)"))));

        RULES.put(
                Language.GRAPHQL,
                List.of(new Rule(
                        Kind.TYPE,
                        Pattern.compile(
                                "^\\s*(?:extend\\s+)?(?:type|input|interface|enum|union|schema|scalar|fragment|query|mutation"
                                        + "|subscription)\\s+(?<n>\\w+)"))));

        RULES.put(
                Language.TERRAFORM,
                List.of(
                        new Rule(Kind.TYPE, Pattern.compile("^(?:resource|data)\\s+\"[^\"]+\"\\s+\"(?<n>[^\"]+)\"")),
                        new Rule(
                                Kind.TYPE,
                                Pattern.compile("^(?:module|variable|output|provider)\\s+\"(?<n>[^\"]+)\""))));

        RULES.put(
                Language.MARKDOWN,
                List.of(new Rule(Kind.SECTION, Pattern.compile("^(?<h>#{1,3})\\s+(?<n>.+?)\\s*#*\\s*$"))));
    }

    private Definitions() {}

    /** True when this language has definition patterns (otherwise chunk by size only). */
    public static boolean supports(Language language) {
        return RULES.containsKey(language);
    }

    public static List<Definition> find(Source source) {
        List<Rule> rules = RULES.get(source.language());
        if (rules == null) {
            return List.of();
        }
        String[] lines = source.lines();
        String[] code = source.code();
        int unit = indentUnit(lines);

        List<Definition> raw = new ArrayList<>();
        boolean inFence = false;
        for (int i = 0; i < lines.length; i++) {
            if (source.language() == Language.MARKDOWN
                    && lines[i].stripLeading().startsWith("```")) {
                inFence = !inFence; // "# comment" lines inside code fences are not headings
                continue;
            }
            if (inFence) {
                continue;
            }
            for (Rule rule : rules) {
                // Markdown has no comments to strip; everything else is matched on code only
                Matcher m = rule.pattern().matcher(source.language() == Language.MARKDOWN ? lines[i] : code[i]);
                if (!m.find()) {
                    continue;
                }
                String name = groupFromOriginal(m, lines[i]);
                if (name == null || name.isBlank() || NOT_NAMES.contains(name)) {
                    continue;
                }
                if (hasGroup(m, "ret") && m.group("ret") != null && anyKeyword(m.group("ret"))) {
                    continue;
                }
                raw.add(build(source, rule.kind(), name.strip(), i, m, unit));
                break;
            }
        }
        return withParents(raw);
    }

    // ------------------------------------------------------------------------------------------

    private static Definition build(Source source, Kind kind, String name, int i, Matcher m, int unit) {
        String[] lines = source.lines();
        String[] code = source.code();
        Language language = source.language();
        int indent = indentOf(lines[i]);
        int end;
        int nesting = 0;

        if (kind == Kind.SECTION) {
            int level = m.group("h").length();
            end = lines.length - 1;
            boolean fence = false;
            for (int j = i + 1; j < lines.length; j++) {
                if (lines[j].stripLeading().startsWith("```")) {
                    fence = !fence;
                    continue;
                }
                Matcher h = HEADING.matcher(lines[j]);
                if (!fence && h.find() && h.group(1).length() <= level) {
                    end = j - 1;
                    break;
                }
            }
        } else if ((language == Language.VUE || language == Language.SVELTE)
                && kind == Kind.TYPE
                && Set.of("template", "script", "style").contains(name)) {
            end = lines.length - 1;
            for (int j = i; j < lines.length; j++) {
                if (lines[j].contains("</" + name)) {
                    end = j;
                    break;
                }
            }
        } else if (language == Language.SQL) {
            end = i;
            for (int j = i; j < lines.length; j++) {
                end = j;
                if (code[j].contains(";")) {
                    break;
                }
            }
        } else if (language.usesBraces()) {
            int[] span = braceSpan(code, i, m.start());
            end = span[0];
            nesting = Math.max(0, span[1] - 1);
        } else {
            int[] span = indentSpan(lines, code, i, indent, language, unit);
            end = span[0];
            nesting = span[1];
        }
        end = trimTrailingBlank(lines, i, Math.max(i, end));
        int params = kind == Kind.FUNCTION ? countParams(code, i, m.end("n")) : 0;
        return new Definition(
                kind,
                name,
                leadingStart(lines, code, i, language),
                i + 1,
                end + 1,
                indent,
                params,
                null,
                false,
                nesting);
    }

    /** {endLineIndex, maxDepth}. Scans to the first '{' (or ';' = declaration without body). */
    private static int[] braceSpan(String[] code, int start, int fromColumn) {
        int depth = 0;
        int maxDepth = 0;
        int parens = 0;
        boolean opened = false;
        int limit = code.length;
        for (int j = start; j < limit; j++) {
            String line = code[j];
            if (!opened && j > start && line.isBlank()) {
                return new int[] {start, 0}; // signature ended without a body (Kotlin "fun x() = 1")
            }
            for (int k = j == start ? Math.min(fromColumn, line.length()) : 0; k < line.length(); k++) {
                char c = line.charAt(k);
                if (!opened && (c == '(' || c == ')')) {
                    parens += c == '(' ? 1 : -1;
                    continue;
                }
                if (!opened && parens > 0) {
                    continue; // braces inside parameters: destructuring, default objects
                }
                if (c == '{') {
                    depth++;
                    opened = true;
                    maxDepth = Math.max(maxDepth, depth);
                } else if (c == '}') {
                    depth--;
                    if (opened && depth <= 0) {
                        return new int[] {j, maxDepth};
                    }
                } else if (c == ';' && !opened) {
                    return new int[] {j, 0};
                }
            }
            if (!opened && j - start >= 8) {
                return new int[] {start, 0}; // no body found (e.g. Kotlin "fun x() = 1")
            }
        }
        return new int[] {opened ? limit - 1 : start, maxDepth};
    }

    /** {endLineIndex, maxNesting} for indentation-delimited languages (Python, Ruby, Elixir, Lua). */
    private static int[] indentSpan(String[] lines, String[] code, int start, int indent, Language language, int unit) {
        int end = start;
        int maxIndent = indent;
        for (int j = start + 1; j < lines.length; j++) {
            if (code[j].isBlank()) {
                continue;
            }
            int lineIndent = indentOf(lines[j]);
            if (lineIndent <= indent) {
                String trimmed = code[j].strip();
                boolean closes = (language != Language.PYTHON)
                        && (trimmed.equals("end") || trimmed.startsWith("end ") || trimmed.startsWith("end."));
                if (closes && lineIndent == indent) {
                    end = j;
                }
                break;
            }
            end = j;
            maxIndent = Math.max(maxIndent, lineIndent);
        }
        int nesting = Math.max(0, (maxIndent - indent) / Math.max(1, unit) - 1);
        return new int[] {end, nesting};
    }

    /** Decorators, annotations, attributes and doc comments directly above a definition belong to it. */
    private static int leadingStart(String[] lines, String[] code, int declIndex, Language language) {
        int start = declIndex;
        for (int j = declIndex - 1; j >= 0 && declIndex - j <= 40; j--) {
            String t = lines[j].strip();
            boolean comment = code[j].isBlank() && !t.isEmpty();
            boolean decorator = t.startsWith("@")
                    || t.startsWith("#[")
                    || (t.startsWith("[") && t.endsWith("]") && language == Language.CSHARP);
            if (comment || decorator) {
                start = j;
            } else {
                break;
            }
        }
        return start + 1;
    }

    private static int countParams(String[] code, int line, int fromColumn) {
        StringBuilder sb = new StringBuilder();
        int depth = 0;
        boolean started = false;
        for (int j = line; j < code.length && j < line + 12; j++) {
            String s = code[j];
            for (int k = j == line ? Math.min(fromColumn, s.length()) : 0; k < s.length(); k++) {
                char c = s.charAt(k);
                if (!started) {
                    if (c == '(') {
                        started = true;
                        depth = 1;
                    } else if (c == '{' || c == ':' || c == '=') {
                        return 0;
                    }
                    continue;
                }
                if (c == '(' || c == '[' || c == '<' || c == '{') {
                    depth++;
                } else if (c == ')' || c == ']' || c == '>' || c == '}') {
                    depth--;
                    if (depth == 0) {
                        return paramCount(sb.toString());
                    }
                } else if (c == ',' && depth == 1) {
                    sb.append('\u0000');
                    continue;
                }
                if (depth >= 1) {
                    sb.append(c);
                }
            }
            sb.append(' ');
        }
        return 0;
    }

    private static int paramCount(String params) {
        int count = 0;
        for (String p : params.split("\u0000")) {
            String t = p.strip();
            if (t.isEmpty()
                    || t.equals("void")
                    || t.equals("self")
                    || t.equals("cls")
                    || t.equals("this")
                    || t.equals("&self")
                    || t.equals("&mut self")
                    || t.equals("mut self")
                    || t.equals("*")
                    || t.equals("/")) {
                continue;
            }
            count++;
        }
        return count;
    }

    /** Fills parent (enclosing type) and insideFunction. */
    private static List<Definition> withParents(List<Definition> defs) {
        List<Definition> out = new ArrayList<>(defs.size());
        for (Definition d : defs) {
            String parent = null;
            int parentSize = Integer.MAX_VALUE;
            boolean insideFunction = false;
            for (Definition o : defs) {
                if (o == d || o.declLine() >= d.declLine() || o.endLine() < d.declLine()) {
                    continue;
                }
                if (o.kind() == Kind.TYPE && o.lines() < parentSize) {
                    parent = o.name();
                    parentSize = o.lines();
                }
                if (o.kind() == Kind.FUNCTION) {
                    insideFunction = true;
                }
            }
            out.add(new Definition(
                    d.kind(),
                    d.name(),
                    d.startLine(),
                    d.declLine(),
                    d.endLine(),
                    d.indent(),
                    d.params(),
                    parent,
                    insideFunction,
                    d.maxNesting()));
        }
        return out;
    }

    private static int trimTrailingBlank(String[] lines, int start, int end) {
        int e = Math.min(end, lines.length - 1);
        while (e > start && lines[e].isBlank()) {
            e--;
        }
        return e;
    }

    static int indentOf(String line) {
        int width = 0;
        for (int k = 0; k < line.length(); k++) {
            char c = line.charAt(k);
            if (c == ' ') {
                width++;
            } else if (c == '\t') {
                width += 4;
            } else {
                break;
            }
        }
        return width;
    }

    /** Smallest indentation step used in the file (2 or 4 usually). */
    private static int indentUnit(String[] lines) {
        int unit = Integer.MAX_VALUE;
        for (String line : lines) {
            if (line.isBlank()) {
                continue;
            }
            int indent = indentOf(line);
            if (indent > 0) {
                unit = Math.min(unit, indent);
            }
        }
        return unit == Integer.MAX_VALUE ? 4 : Math.max(2, unit);
    }

    /** Names are matched on comment-free text but read from the original line (quoted SQL names...). */
    private static String groupFromOriginal(Matcher m, String original) {
        int s = m.start("n");
        int e = m.end("n");
        if (s >= 0 && e <= original.length()) {
            String fromOriginal = original.substring(s, e).replace("\"", "").replace("`", "");
            if (!fromOriginal.isBlank()) {
                return fromOriginal;
            }
        }
        return m.group("n");
    }

    private static boolean anyKeyword(String words) {
        for (String w : words.split("\\s+")) {
            if (NOT_NAMES.contains(w)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasGroup(Matcher m, String group) {
        try {
            m.start(group);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
