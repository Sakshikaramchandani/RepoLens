package com.repolens.risk;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ParserConfiguration.LanguageLevel;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.CallableDeclaration;
import com.github.javaparser.ast.expr.BinaryExpr;
import com.github.javaparser.ast.expr.ConditionalExpr;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.stmt.CatchClause;
import com.github.javaparser.ast.stmt.DoStmt;
import com.github.javaparser.ast.stmt.ForEachStmt;
import com.github.javaparser.ast.stmt.ForStmt;
import com.github.javaparser.ast.stmt.IfStmt;
import com.github.javaparser.ast.stmt.SwitchEntry;
import com.github.javaparser.ast.stmt.WhileStmt;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Static risk metrics for one Java file. Deterministic and offline — no AI involved.
 *
 * complexity          sum of McCabe cyclomatic complexity over all methods/constructors
 * maxMethodComplexity the worst single method
 * loc                 non-blank, non-comment lines
 * warnings            code smells: empty/generic catch, console output, long or complex methods,
 *                     too many parameters, TODO/FIXME
 *
 * score (0-100) = 40·worst method + 20·total complexity + 15·size + 25·warnings, each normalised.
 */
public final class JavaRiskAnalyzer {

    static final int COMPLEX_METHOD = 10;
    static final int LONG_METHOD_LINES = 60;
    static final int MANY_PARAMETERS = 5;

    private static final Set<String> GENERIC_EXCEPTIONS = Set.of("Exception", "Throwable", "RuntimeException");
    private static final Pattern TODO = Pattern.compile("(?i)\\b(TODO|FIXME|XXX|HACK)\\b");

    public record Metrics(
            int complexity,
            int maxMethodComplexity,
            int loc,
            int methods,
            int warnings,
            List<String> findings,
            int score,
            String label,
            boolean parsed) {}

    private JavaRiskAnalyzer() {}

    public static Metrics analyze(String content) {
        String source = content == null ? "" : content;
        int loc = countLoc(source);
        Findings findings = new Findings();

        int todos = countMatches(TODO, source);
        findings.add(todos, todos + " TODO/FIXME comment" + plural(todos));

        ParseResult<CompilationUnit> result =
                new JavaParser(new ParserConfiguration().setLanguageLevel(LanguageLevel.JAVA_21)).parse(source);
        if (!result.isSuccessful() || result.getResult().isEmpty()) {
            findings.messages.add(0, "Could not be parsed as Java — metrics are size-only");
            int score = score(0, 0, loc, findings.warnings);
            return new Metrics(0, 0, loc, 0, findings.warnings, findings.top(), score, label(score), false);
        }
        CompilationUnit unit = result.getResult().get();

        MethodStats methods = methodStats(unit);
        findings.warnings += methods.warnings();
        catchFindings(unit, findings);
        consoleFindings(unit, findings);
        findings.messages.addAll(0, methods.findings());

        int score = score(methods.worst(), methods.total(), loc, findings.warnings);
        return new Metrics(
                methods.total(),
                methods.worst(),
                loc,
                methods.count(),
                findings.warnings,
                findings.top(),
                score,
                label(score),
                true);
    }

    /** Warnings counter + human-readable reasons, most important first. */
    private static final class Findings {
        final List<String> messages = new ArrayList<>();
        int warnings;

        void add(int count, String message) {
            if (count > 0) {
                warnings += count;
                messages.add(message);
            }
        }

        List<String> top() {
            return messages.size() > 6 ? List.copyOf(messages.subList(0, 6)) : List.copyOf(messages);
        }
    }

    private record MethodStats(int total, int worst, int count, int warnings, List<String> findings) {}

    private static MethodStats methodStats(CompilationUnit unit) {
        int total = 0;
        int worst = 0;
        int count = 0;
        int warnings = 0;
        List<String> found = new ArrayList<>();
        for (CallableDeclaration<?> callable : unit.findAll(CallableDeclaration.class)) {
            count++;
            int cc = cyclomatic(callable);
            total += cc;
            worst = Math.max(worst, cc);
            String name = callable.getNameAsString() + "()";
            int lines = lineSpan(callable);
            int params = callable.getParameters().size();
            if (cc > COMPLEX_METHOD) {
                warnings++;
                found.add("Complex method " + name + " — complexity " + cc + lineSuffix(callable));
            }
            if (lines > LONG_METHOD_LINES) {
                warnings++;
                found.add("Long method " + name + " — " + lines + " lines" + lineSuffix(callable));
            }
            if (params > MANY_PARAMETERS) {
                warnings++;
                found.add(name + " takes " + params + " parameters");
            }
        }
        found.sort((a, b) -> Integer.compare(severityOf(b), severityOf(a)));
        return new MethodStats(total, worst, count, warnings, found);
    }

    private static void catchFindings(CompilationUnit unit, Findings findings) {
        int empty = 0;
        int generic = 0;
        for (CatchClause clause : unit.findAll(CatchClause.class)) {
            if (clause.getBody().getStatements().isEmpty()) {
                empty++;
            }
            if (isGeneric(clause.getParameter().getType().asString())) {
                generic++;
            }
        }
        if (empty > 0) {
            findings.warnings += empty;
            findings.messages.add(0, empty + " empty catch block" + plural(empty) + " (errors are swallowed)");
        }
        findings.add(generic, "Catches generic Exception/Throwable " + generic + "×");
    }

    private static boolean isGeneric(String caughtType) {
        for (String alternative : caughtType.split("\\|")) {
            if (GENERIC_EXCEPTIONS.contains(alternative.trim())) {
                return true;
            }
        }
        return false;
    }

    private static void consoleFindings(CompilationUnit unit, Findings findings) {
        int console = 0;
        for (MethodCallExpr call : unit.findAll(MethodCallExpr.class)) {
            String scope = call.getScope().map(Node::toString).orElse("");
            if (scope.equals("System.out")
                    || scope.equals("System.err")
                    || call.getNameAsString().equals("printStackTrace")) {
                console++;
            }
        }
        findings.add(console, "Console output / printStackTrace " + console + "× instead of a logger");
    }

    private static String plural(int n) {
        return n == 1 ? "" : "s";
    }

    /** 1 + decision points. Nested lambdas/anonymous classes count towards the enclosing method. */
    static int cyclomatic(Node node) {
        int decisions = node.findAll(IfStmt.class).size()
                + node.findAll(ForStmt.class).size()
                + node.findAll(ForEachStmt.class).size()
                + node.findAll(WhileStmt.class).size()
                + node.findAll(DoStmt.class).size()
                + node.findAll(CatchClause.class).size()
                + node.findAll(ConditionalExpr.class).size()
                + (int) node.findAll(SwitchEntry.class).stream()
                        .filter(e -> !e.getLabels().isEmpty())
                        .count()
                + (int) node.findAll(BinaryExpr.class).stream()
                        .filter(b ->
                                b.getOperator() == BinaryExpr.Operator.AND || b.getOperator() == BinaryExpr.Operator.OR)
                        .count();
        return 1 + decisions;
    }

    static int score(int worstMethod, int totalComplexity, int loc, int warnings) {
        double s = 40 * Math.min(1.0, worstMethod / 20.0)
                + 20 * Math.min(1.0, totalComplexity / 80.0)
                + 15 * Math.min(1.0, loc / 500.0)
                + 25 * Math.min(1.0, warnings / 8.0);
        return (int) Math.round(s);
    }

    /**
     * Score with git history: churn and bug-fix commits weigh as much as complexity — files that
     * change often and keep needing fixes are where the next bug is most likely.
     */
    static int scoreWithHistory(
            int worstMethod, int totalComplexity, int loc, int warnings, int commits, int bugFixCommits) {
        double s = 30 * Math.min(1.0, worstMethod / 20.0)
                + 15 * Math.min(1.0, totalComplexity / 80.0)
                + 10 * Math.min(1.0, loc / 500.0)
                + 15 * Math.min(1.0, warnings / 8.0)
                + 15 * Math.min(1.0, commits / 20.0)
                + 15 * Math.min(1.0, bugFixCommits / 5.0);
        return (int) Math.round(s);
    }

    static String label(int score) {
        return score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
    }

    static int countLoc(String source) {
        int count = 0;
        boolean inBlockComment = false;
        for (String raw : source.split("\r?\n")) {
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            if (inBlockComment) {
                if (line.contains("*/")) {
                    inBlockComment = false;
                    line = line.substring(line.indexOf("*/") + 2).trim();
                    if (line.isEmpty()) {
                        continue;
                    }
                } else {
                    continue;
                }
            }
            if (line.startsWith("//")) {
                continue;
            }
            if (line.startsWith("/*")) {
                if (!line.contains("*/")) {
                    inBlockComment = true;
                }
                continue;
            }
            count++;
        }
        return count;
    }

    private static int lineSpan(Node node) {
        return node.getRange().map(r -> r.end.line - r.begin.line + 1).orElse(0);
    }

    private static String lineSuffix(Node node) {
        return node.getBegin().map(p -> " (line " + p.line + ")").orElse("");
    }

    private static int severityOf(String finding) {
        String f = finding.toLowerCase(Locale.ROOT);
        return f.startsWith("complex") ? 2 : f.startsWith("long") ? 1 : 0;
    }

    private static int countMatches(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        int n = 0;
        while (m.find()) {
            n++;
        }
        return n;
    }
}
