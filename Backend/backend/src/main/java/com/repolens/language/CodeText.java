package com.repolens.language;

/**
 * Removes comments and string contents from source text, keeping every newline (so line numbers stay
 * valid) and replacing removed characters with spaces. Used before counting braces, branches and
 * code lines, so a "{" or an "if" inside a string or comment is never counted.
 *
 * It is a lexer-lite: good enough for metrics and structure, not a full parser.
 */
public final class CodeText {

    private CodeText() {}

    public static String strip(String source, Language.Syntax syntax) {
        if (source == null || source.isEmpty() || syntax == Language.Syntax.NONE) {
            return source == null ? "" : source;
        }
        char[] in = source.toCharArray();
        StringBuilder out = new StringBuilder(in.length);
        int i = 0;
        while (i < in.length) {
            char c = in[i];
            char next = i + 1 < in.length ? in[i + 1] : '\0';

            // ---- block comments ----
            if ((syntax == Language.Syntax.C_LIKE || syntax == Language.Syntax.SCRIPT || syntax == Language.Syntax.SQL)
                    && c == '/'
                    && next == '*') {
                i = blank(in, out, i, indexOf(in, "*/", i + 2), 2);
                continue;
            }
            if (syntax == Language.Syntax.MARKUP && c == '<' && startsWith(in, i, "<!--")) {
                i = blank(in, out, i, indexOf(in, "-->", i + 4), 3);
                continue;
            }
            if (syntax == Language.Syntax.LUA && c == '-' && startsWith(in, i, "--[[")) {
                i = blank(in, out, i, indexOf(in, "]]", i + 4), 2);
                continue;
            }

            // ---- line comments ----
            boolean lineComment = switch (syntax) {
                case C_LIKE -> c == '/' && next == '/';
                case SCRIPT -> (c == '/' && next == '/') || (c == '#' && atLineStartOrSpace(in, i) && next != '[');
                case HASH -> c == '#' && atLineStartOrSpace(in, i);
                case SQL, LUA -> c == '-' && next == '-';
                default -> false;
            };
            if (lineComment) {
                while (i < in.length && in[i] != '\n') {
                    out.append(' ');
                    i++;
                }
                continue;
            }

            // ---- strings ----
            if (syntax == Language.Syntax.HASH
                    && (c == '"' || c == '\'')
                    && i + 2 < in.length
                    && in[i + 1] == c
                    && in[i + 2] == c) {
                String fence = String.valueOf(new char[] {c, c, c});
                i = blank(in, out, i, indexOf(in, fence, i + 3), 3);
                continue;
            }
            if (c == '"' || c == '`' || (c == '\'' && singleQuoteIsString(syntax, in, i))) {
                if (c == '`' && syntax != Language.Syntax.SCRIPT && syntax != Language.Syntax.C_LIKE) {
                    out.append(c);
                    i++;
                    continue;
                }
                int end = closingQuote(in, i, c);
                if (end <= i) { // a quote as the last character of a line
                    out.append(c);
                    i++;
                    continue;
                }
                // keep the quotes so "x" still reads as one token, blank what is inside
                out.append(c);
                for (int j = i + 1; j < end && j < in.length; j++) {
                    out.append(in[j] == '\n' ? '\n' : ' ');
                }
                if (end < in.length) {
                    out.append(c);
                }
                i = end + 1;
                continue;
            }
            out.append(c);
            i++;
        }
        return out.toString();
    }

    /** Non-blank lines once comments are gone. */
    public static int codeLines(String stripped) {
        int count = 0;
        for (String line : stripped.split("\r?\n", -1)) {
            if (!line.isBlank()) {
                count++;
            }
        }
        return count;
    }

    // ------------------------------------------------------------------------------------------

    /** C-like languages: '...' is a char literal ('a', '\n') — otherwise (Rust lifetimes 'a) a plain char. */
    private static boolean singleQuoteIsString(Language.Syntax syntax, char[] in, int i) {
        if (syntax != Language.Syntax.C_LIKE) {
            return syntax != Language.Syntax.MARKUP;
        }
        for (int j = i + 1; j < in.length && j <= i + 7; j++) {
            if (in[j] == '\n') {
                return false;
            }
            if (in[j] == '\\') {
                j++;
                continue;
            }
            if (in[j] == '\'') {
                return true;
            }
        }
        return false;
    }

    private static int closingQuote(char[] in, int start, char quote) {
        boolean multiline = quote == '`';
        for (int j = start + 1; j < in.length; j++) {
            char c = in[j];
            if (c == '\\') {
                j++;
                continue;
            }
            if (c == quote) {
                return j;
            }
            if (c == '\n' && !multiline) {
                return j - 1; // unterminated: stop at the line end
            }
        }
        return in.length;
    }

    /** Blank in[from..end+tailLength) (end = index of the closing token, -1 = until EOF). */
    private static int blank(char[] in, StringBuilder out, int from, int end, int tailLength) {
        int stop = end < 0 ? in.length : Math.min(in.length, end + tailLength);
        for (int j = from; j < stop; j++) {
            out.append(in[j] == '\n' ? '\n' : ' ');
        }
        return stop;
    }

    private static boolean atLineStartOrSpace(char[] in, int i) {
        return i == 0 || Character.isWhitespace(in[i - 1]);
    }

    private static boolean startsWith(char[] in, int i, String token) {
        if (i + token.length() > in.length) {
            return false;
        }
        for (int k = 0; k < token.length(); k++) {
            if (in[i + k] != token.charAt(k)) {
                return false;
            }
        }
        return true;
    }

    private static int indexOf(char[] in, String token, int from) {
        for (int i = from; i <= in.length - token.length(); i++) {
            if (startsWith(in, i, token)) {
                return i;
            }
        }
        return -1;
    }
}
