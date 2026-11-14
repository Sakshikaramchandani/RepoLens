package com.repolens.chunking;

import com.repolens.indexing.ChunkType;
import com.repolens.indexing.CodeChunk;
import com.repolens.language.Definitions;
import com.repolens.language.Definitions.Definition;
import com.repolens.language.Language;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Chunks a file of ANY supported language along its structure: a chunk starts where a function,
 * type or Markdown section starts (with its comments and decorators), so code is never cut in the
 * middle of a function. Tiny neighbours are merged, very long pieces split with a small overlap.
 * Languages without definition patterns (JSON, YAML, CSS...) are cut into line windows.
 *
 * Java gets the more precise JavaParser chunker ({@link AstCodeChunker}); this is everything else.
 */
final class StructureChunker {

    private final int maxLines;
    private final int minLines;
    private final int overlapLines;
    private final int maxChunkChars;

    StructureChunker(int maxLines, int minLines, int overlapLines, int maxChunkChars) {
        this.maxLines = maxLines;
        this.minLines = minLines;
        this.overlapLines = overlapLines;
        this.maxChunkChars = maxChunkChars;
    }

    /** A labelled line range (1-based, inclusive). */
    private record Piece(int start, int end, String className, String methodName, ChunkType type) {

        int lines() {
            return end - start + 1;
        }
    }

    List<CodeChunk> chunk(Long projectId, String path, String content, Language language) {
        Definitions.Source source = Definitions.Source.of(language, content);
        String[] lines = source.lines();
        if (lines.length == 0) {
            return List.of();
        }

        // boundary line → label of the definition starting there (top-level and class members only)
        TreeMap<Integer, Piece> boundaries = new TreeMap<>();
        boundaries.put(1, new Piece(1, 1, null, null, ChunkType.FILE));
        for (Definition d : Definitions.find(source)) {
            if (d.insideFunction()) {
                continue; // a nested helper stays with the function around it
            }
            ChunkType type = switch (d.kind()) {
                case FUNCTION -> ChunkType.METHOD;
                case TYPE -> ChunkType.CLASS;
                case SECTION -> ChunkType.FILE;
            };
            String className = d.kind() == Definitions.Kind.TYPE ? d.name() : d.parent();
            String methodName = d.kind() == Definitions.Kind.TYPE ? null : d.name();
            boundaries.put(d.startLine(), new Piece(d.startLine(), d.startLine(), className, methodName, type));
        }

        // boundaries → consecutive pieces covering the whole file
        List<Piece> pieces = new ArrayList<>();
        List<Integer> starts = new ArrayList<>(boundaries.keySet());
        for (int i = 0; i < starts.size(); i++) {
            int start = starts.get(i);
            int end = i + 1 < starts.size() ? starts.get(i + 1) - 1 : lines.length;
            while (end > start && lines[end - 1].isBlank()) {
                end--; // blank lines between functions belong to nobody
            }
            Piece label = boundaries.get(start);
            if (end >= start && !isBlank(lines, start, end)) {
                pieces.add(new Piece(start, end, label.className(), label.methodName(), label.type()));
            }
        }

        List<CodeChunk> out = new ArrayList<>();
        for (Piece piece : merge(pieces)) {
            out.addAll(window(projectId, path, lines, piece));
        }
        return out;
    }

    /** Small pieces (imports, one-line getters) join their neighbour, up to maxLines. */
    private List<Piece> merge(List<Piece> pieces) {
        List<Piece> out = new ArrayList<>();
        Piece current = null;
        for (Piece next : pieces) {
            if (current == null) {
                current = next;
                continue;
            }
            // a tiny piece (imports, a class header, a one-line getter) never stands alone
            boolean merge = current.lines() < minLines
                    || (next.lines() < minLines && current.lines() + next.lines() <= maxLines);
            if (merge) {
                Piece label = rank(next) > rank(current) ? next : current;
                current = new Piece(current.start(), next.end(), label.className(), label.methodName(), label.type());
            } else {
                out.add(current);
                current = next;
            }
        }
        if (current != null) {
            out.add(current);
        }
        return out;
    }

    /** The most specific label wins when pieces merge: function > type > plain text. */
    private static int rank(Piece p) {
        return switch (p.type()) {
            case METHOD -> 2;
            case CLASS -> 1;
            case FILE -> 0;
        };
    }

    private List<CodeChunk> window(Long projectId, String path, String[] lines, Piece piece) {
        List<CodeChunk> out = new ArrayList<>();
        int step = maxLines - overlapLines;
        for (int start = piece.start(); start <= piece.end(); start += step) {
            int end = Math.min(start + maxLines - 1, piece.end());
            String text = String.join("\n", Arrays.copyOfRange(lines, start - 1, end));
            if (!text.isBlank()) {
                out.add(newChunk(
                        projectId, path, piece.className(), piece.methodName(), start, end, limit(text), piece.type()));
            }
            if (end == piece.end()) {
                break;
            }
        }
        return out;
    }

    private static boolean isBlank(String[] lines, int start, int end) {
        for (int i = start; i <= end && i <= lines.length; i++) {
            if (!lines[i - 1].isBlank()) {
                return false;
            }
        }
        return true;
    }

    private String limit(String text) {
        return text.length() <= maxChunkChars ? text : text.substring(0, maxChunkChars) + "\n... (truncated)";
    }

    /** Same stable-id scheme as AstCodeChunker: the same code in the same place keeps its id. */
    static CodeChunk newChunk(
            Long projectId,
            String path,
            String className,
            String methodName,
            int startLine,
            int endLine,
            String content,
            ChunkType type) {
        String key = projectId + "|" + path + "|" + type + "|" + className + "|" + methodName + "|" + startLine + "-"
                + endLine;
        String id = UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString();
        return new CodeChunk(id, projectId, path, className, methodName, startLine, endLine, content, type);
    }
}
