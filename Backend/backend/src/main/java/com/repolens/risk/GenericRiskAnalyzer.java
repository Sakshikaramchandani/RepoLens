package com.repolens.risk;

import com.repolens.language.CodeText;
import com.repolens.language.Definitions;
import com.repolens.language.Definitions.Definition;
import com.repolens.language.Language;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Static risk metrics for a source file in any language that is not Java (Java has the more
 * precise JavaParser-based {@link JavaRiskAnalyzer}). Same metrics, same score:
 *
 * complexity  1 + decision points (if, loops, case, catch, && ...) per function, comments and strings removed
 * loc         non-blank, non-comment lines
 * warnings    complex / long / deeply nested functions, too many parameters, empty or catch-all error
 *             handlers, debug output, eval(), TODO/FIXME
 */
public final class GenericRiskAnalyzer {

    private static final Pattern TODO = Pattern.compile("(?i)\\b(TODO|FIXME|XXX|HACK)\\b");
    private static final Pattern C_DECISIONS =
            Pattern.compile("\\b(if|for|foreach|while|case|catch|elseif)\\b|&&|\\|\\||\\s\\?\\s|\\?\\?");

    private static final Map<Language, Pattern> DECISIONS = Map.ofEntries(
            Map.entry(Language.PYTHON, Pattern.compile("\\b(if|elif|for|while|except|and|or|case)\\b")),
            Map.entry(
                    Language.RUBY,
                    Pattern.compile("\\b(if|elsif|unless|while|until|for|when|rescue|and|or)\\b|&&|\\|\\|")),
            Map.entry(Language.ELIXIR, Pattern.compile("\\b(if|unless|cond|case|when|rescue|and|or)\\b|&&|\\|\\|")),
            Map.entry(Language.LUA, Pattern.compile("\\b(if|elseif|for|while|repeat|and|or)\\b")),
            Map.entry(Language.SHELL, Pattern.compile("\\b(if|elif|for|while|until|case)\\b|&&|\\|\\|")),
            Map.entry(
                    Language.POWERSHELL,
                    Pattern.compile("(?i)\\b(if|elseif|for|foreach|while|switch|catch)\\b|-and\\b|-or\\b")),
            Map.entry(Language.R, Pattern.compile("\\b(if|for|while|repeat)\\b|&&|\\|\\|")),
            Map.entry(Language.RUST, Pattern.compile("\\b(if|for|while|loop)\\b|&&|\\|\\||=>|\\?(?=[;.)\\s])")),
            Map.entry(
                    Language.SWIFT,
                    Pattern.compile("\\b(if|for|while|case|catch|guard)\\b|&&|\\|\\||\\s\\?\\s|\\?\\?")),
            Map.entry(Language.KOTLIN, Pattern.compile("\\b(if|for|while|catch)\\b|&&|\\|\\||->|\\?:")),
            Map.entry(Language.GO, Pattern.compile("\\b(if|for|case|select)\\b|&&|\\|\\|")));

    /** Error handler with an empty body. */
    private static final Map<Language.Syntax, Pattern> EMPTY_HANDLER = Map.of(
            Language.Syntax.C_LIKE, Pattern.compile("catch\\s*(?:\\([^)]*\\))?\\s*\\{\\s*\\}"),
            Language.Syntax.SCRIPT, Pattern.compile("catch\\s*(?:\\([^)]*\\))?\\s*\\{\\s*\\}"),
            Language.Syntax.HASH,
                    Pattern.compile("(?:except[^:\\n]*:\\s*\\n\\s*pass\\b|rescue\\b[^\\n]*\\n\\s*end\\b)"));

    private static final Map<Language, Pattern> CATCH_ALL = Map.of(
            Language.PYTHON, Pattern.compile("except\\s*:|except\\s+(?:Exception|BaseException)\\b"),
            Language.CSHARP, Pattern.compile("catch\\s*\\(\\s*(?:System\\.)?Exception\\b"),
            Language.KOTLIN, Pattern.compile("catch\\s*\\(\\s*\\w+\\s*:\\s*(?:Exception|Throwable)\\s*\\)"),
            Language.PHP, Pattern.compile("catch\\s*\\(\\s*\\\\?(?:Exception|Throwable)\\b"),
            Language.RUBY, Pattern.compile("rescue\\s*(?:Exception\\b|=>|$)", Pattern.MULTILINE),
            Language.DART, Pattern.compile("catch\\s*\\(\\s*e\\s*\\)\\s*\\{"));

    private static final Pattern JS_CONSOLE = Pattern.compile("\\bconsole\\.(?:log|debug|info|trace)\\s*\\(");
    private static final Pattern PRINT_CALL = Pattern.compile("(?<![\\w.])print\\s*\\(");
    private static final Map<Language, Pattern> DEBUG_OUTPUT = Map.ofEntries(
            Map.entry(Language.JAVASCRIPT, JS_CONSOLE),
            Map.entry(Language.TYPESCRIPT, JS_CONSOLE),
            Map.entry(Language.VUE, JS_CONSOLE),
            Map.entry(Language.SVELTE, JS_CONSOLE),
            Map.entry(Language.PYTHON, PRINT_CALL),
            Map.entry(Language.DART, PRINT_CALL),
            Map.entry(Language.GO, Pattern.compile("\\bfmt\\.Print(?:ln|f)?\\s*\\(")),
            Map.entry(Language.RUST, Pattern.compile("\\b(?:println|print|dbg|eprintln)!\\s*\\(")),
            Map.entry(Language.CSHARP, Pattern.compile("\\bConsole\\.Write(?:Line)?\\s*\\(")),
            Map.entry(Language.KOTLIN, Pattern.compile("(?<![\\w.])println\\s*\\(")),
            Map.entry(Language.SCALA, Pattern.compile("(?<![\\w.])println\\s*\\(")),
            Map.entry(Language.SWIFT, Pattern.compile("(?<![\\w.])(?:print|debugPrint)\\s*\\(")),
            Map.entry(Language.RUBY, Pattern.compile("(?m)^\\s*(?:puts|p|pp)\\s")),
            Map.entry(Language.PHP, Pattern.compile("\\b(?:var_dump|print_r|var_export)\\s*\\(")));

    private static final Pattern EVAL = Pattern.compile("(?<![\\w.])eval\\s*\\(");
    private static final Set<Language> EVAL_LANGUAGES =
            Set.of(Language.JAVASCRIPT, Language.TYPESCRIPT, Language.PYTHON, Language.PHP, Language.RUBY);

    private GenericRiskAnalyzer() {}

    public static JavaRiskAnalyzer.Metrics analyze(Language language, String content) {
        String source = content == null ? "" : content;
        Definitions.Source parsed = Definitions.Source.of(language, source);
        String code = String.join("\n", parsed.code());
        int loc = CodeText.codeLines(code);
        Pattern decisions = DECISIONS.getOrDefault(language, C_DECISIONS);

        List<String> methodFindings = new ArrayList<>();
        List<String> findings = new ArrayList<>();
        int warnings = 0;
        int total = 0;
        int worst = 0;
        int functions = 0;

        for (Definition d : Definitions.find(parsed)) {
            if (d.kind() != Definitions.Kind.FUNCTION) {
                continue;
            }
            functions++;
            int cc = 1 + count(decisions, parsed.code(), d.declLine(), d.endLine());
            total += cc;
            worst = Math.max(worst, cc);
            String name = d.name() + "()";
            String at = " (line " + d.declLine() + ")";
            if (cc > JavaRiskAnalyzer.COMPLEX_METHOD) {
                warnings++;
                methodFindings.add("Complex function " + name + " — complexity " + cc + at);
            }
            if (d.lines() > JavaRiskAnalyzer.LONG_METHOD_LINES) {
                warnings++;
                methodFindings.add("Long function " + name + " — " + d.lines() + " lines" + at);
            }
            if (d.params() > JavaRiskAnalyzer.MANY_PARAMETERS) {
                warnings++;
                methodFindings.add(name + " takes " + d.params() + " parameters");
            }
            if (d.maxNesting() > 4) {
                warnings++;
                methodFindings.add("Deep nesting in " + name + " — " + d.maxNesting() + " levels" + at);
            }
        }
        if (functions == 0) { // a script: the whole file is one unit
            total = 1 + count(decisions, parsed.code(), 1, parsed.code().length);
            worst = total;
        }

        int empty = count(EMPTY_HANDLER.get(language.syntax()), code);
        if (empty > 0) {
            warnings += empty;
            findings.add(empty + " empty error handler" + (empty == 1 ? "" : "s") + " (errors are swallowed)");
        }
        int catchAll = count(CATCH_ALL.get(language), code);
        if (catchAll > 0) {
            warnings += catchAll;
            findings.add("Catches every exception " + catchAll + "×");
        }
        int debug = count(DEBUG_OUTPUT.get(language), code);
        if (debug > 0) {
            warnings += debug;
            findings.add("Debug output " + debug + "× instead of a logger");
        }
        if (EVAL_LANGUAGES.contains(language)) {
            int evals = count(EVAL, code);
            if (evals > 0) {
                warnings += evals;
                findings.add("Uses eval() " + evals + "× (code injection risk)");
            }
        }
        int todos = count(TODO, source);
        if (todos > 0) {
            warnings += todos;
            findings.add(todos + " TODO/FIXME comment" + (todos == 1 ? "" : "s"));
        }

        methodFindings.sort((a, b) -> Integer.compare(rank(b), rank(a)));
        findings.addAll(0, methodFindings);
        int score = JavaRiskAnalyzer.score(worst, total, loc, warnings);
        List<String> top = findings.size() > 6 ? List.copyOf(findings.subList(0, 6)) : List.copyOf(findings);
        return new JavaRiskAnalyzer.Metrics(
                total, worst, loc, functions, warnings, top, score, JavaRiskAnalyzer.label(score), true);
    }

    private static int count(Pattern pattern, String[] lines, int fromLine, int toLine) {
        int n = 0;
        for (int i = Math.max(1, fromLine); i <= toLine && i <= lines.length; i++) {
            Matcher m = pattern.matcher(lines[i - 1]);
            while (m.find()) {
                n++;
            }
        }
        return n;
    }

    private static int count(Pattern pattern, String text) {
        if (pattern == null) {
            return 0;
        }
        int n = 0;
        Matcher m = pattern.matcher(text);
        while (m.find()) {
            n++;
        }
        return n;
    }

    private static int rank(String finding) {
        return finding.startsWith("Complex") ? 3 : finding.startsWith("Deep") ? 2 : finding.startsWith("Long") ? 1 : 0;
    }
}
