package com.repolens.chunking;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ParserConfiguration.LanguageLevel;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.BodyDeclaration;
import com.github.javaparser.ast.body.CallableDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.nodeTypes.NodeWithBlockStmt;
import com.github.javaparser.ast.stmt.BlockStmt;
import com.repolens.indexing.ChunkType;
import com.repolens.indexing.CodeChunk;
import com.repolens.indexing.CodeChunker;
import com.repolens.language.Language;
import com.repolens.language.Languages;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * The chunker the indexing job uses (@Primary; FallbackLineChunker only runs if this throws).
 *
 * Java (JavaParser AST, never cut in the middle of a method):
 *   - every class / interface / enum / record  → 1 CLASS chunk (declaration + fields + method signatures)
 *   - every method / constructor               → 1 METHOD chunk (full code incl. javadoc + annotations)
 *   - a method longer than maxMethodLines      → several METHOD chunks with a small overlap
 * Every other language (Python, TypeScript, Go, Rust, C#, ...) and Java that does not parse →
 * {@link StructureChunker}: one chunk per function / type / Markdown section, by pattern.
 * Files that should not be indexed (see IndexableFiles) → empty list.
 */
@Primary
@Component
public class AstCodeChunker implements CodeChunker {

    private final int maxMethodLines;
    private final int textChunkLines;
    private final int overlapLines;
    private final int maxChunkChars;
    private final StructureChunker structureChunker;

    public AstCodeChunker() {
        this(60, 80, 10, 6000);
    }

    /** For tests: small limits make splitting easy to check. */
    AstCodeChunker(int maxMethodLines, int textChunkLines, int overlapLines, int maxChunkChars) {
        if (overlapLines >= maxMethodLines || overlapLines >= textChunkLines) {
            throw new IllegalArgumentException("overlap must be smaller than the chunk size");
        }
        this.maxMethodLines = maxMethodLines;
        this.textChunkLines = textChunkLines;
        this.overlapLines = overlapLines;
        this.maxChunkChars = maxChunkChars;
        this.structureChunker = new StructureChunker(textChunkLines, 6, overlapLines, maxChunkChars);
    }

    @Override
    public List<CodeChunk> chunk(Long projectId, String filePath, String content) {
        if (content == null || content.isBlank() || !IndexableFiles.isIndexable(filePath)) {
            return List.of();
        }
        if (IndexableFiles.looksGenerated(content)) {
            return List.of();
        }
        String path = filePath.replace('\\', '/');
        String[] lines = content.split("\r?\n", -1);

        Language language = Languages.detect(path).orElse(null);
        if (language == Language.JAVA) {
            List<CodeChunk> javaChunks = chunkJava(projectId, path, content, lines);
            if (!javaChunks.isEmpty()) {
                return javaChunks;
            }
            // syntax error or no class in the file → structure patterns still find its methods
        }
        if (language != null) {
            return structureChunker.chunk(projectId, path, content, language);
        }
        return chunkText(projectId, path, lines, null, null, ChunkType.FILE, 1, lines.length, textChunkLines);
    }

    // ------------------------------------------------------------------ Java (AST)

    private List<CodeChunk> chunkJava(Long projectId, String path, String content, String[] lines) {
        ParserConfiguration config = new ParserConfiguration()
                .setLanguageLevel(LanguageLevel.JAVA_21) // records, switch expressions, text blocks ...
                .setAttributeComments(true); // javadoc stays attached to its method
        ParseResult<CompilationUnit> result = new JavaParser(config).parse(content);
        if (!result.isSuccessful() || result.getResult().isEmpty()) {
            return List.of();
        }
        List<CodeChunk> chunks = new ArrayList<>();
        for (TypeDeclaration<?> type : result.getResult().get().getTypes()) {
            chunkType(projectId, path, lines, type, chunks);
        }
        return chunks;
    }

    /** One class (and, recursively, its nested classes). */
    private void chunkType(Long projectId, String path, String[] lines, TypeDeclaration<?> type, List<CodeChunk> out) {
        if (type.getRange().isEmpty()) {
            return;
        }
        String className = qualifiedName(type);
        int start = startLineWithComment(type);
        int end = type.getRange().get().end.line;

        // 1) CLASS chunk: an overview without method bodies (class annotations included)
        out.add(newChunk(projectId, path, className, null, start, end, limit(classSkeleton(type)), ChunkType.CLASS));

        // 2) METHOD chunks: every method and constructor declared directly in this class
        for (BodyDeclaration<?> member : type.getMembers()) {
            if (member instanceof CallableDeclaration<?> callable
                    && callable.getRange().isPresent()) {
                int mStart = startLineWithComment(callable);
                int mEnd = callable.getRange().get().end.line;
                out.addAll(chunkText(
                        projectId,
                        path,
                        lines,
                        className,
                        callable.getNameAsString(),
                        ChunkType.METHOD,
                        mStart,
                        mEnd,
                        maxMethodLines));
            }
        }

        // 3) nested classes get their own chunks
        for (BodyDeclaration<?> member : type.getMembers()) {
            if (member instanceof TypeDeclaration<?> nested) {
                chunkType(projectId, path, lines, nested, out);
            }
        }
    }

    /** Copy of the class with every method/constructor body emptied and nested classes removed. */
    private static String classSkeleton(TypeDeclaration<?> type) {
        TypeDeclaration<?> copy = type.clone();
        copy.getMembers().removeIf(m -> m instanceof TypeDeclaration);
        for (BodyDeclaration<?> member : copy.getMembers()) {
            if (member instanceof MethodDeclaration method) {
                if (method.getBody().isPresent()) {
                    method.setBody(new BlockStmt()); // keeps "{ }" so it still reads like Java
                }
            } else if (member instanceof NodeWithBlockStmt<?> withBody) {
                withBody.setBody(new BlockStmt()); // constructors, initializer blocks, compact constructors
            }
        }
        return copy.toString();
    }

    // ------------------------------------------------------------------ plain lines

    /**
     * Lines [from..to] (1-based, inclusive) as one chunk, or as several overlapping chunks
     * when longer than maxLines. Blank pieces are dropped.
     */
    private List<CodeChunk> chunkText(
            Long projectId,
            String path,
            String[] lines,
            String className,
            String methodName,
            ChunkType type,
            int from,
            int to,
            int maxLines) {
        List<CodeChunk> out = new ArrayList<>();
        int last = Math.min(to, lines.length);
        int step = maxLines - overlapLines;
        for (int start = Math.max(1, from); start <= last; start += step) {
            int end = Math.min(start + maxLines - 1, last);
            String text = String.join("\n", Arrays.copyOfRange(lines, start - 1, end));
            if (!text.isBlank()) {
                out.add(newChunk(projectId, path, className, methodName, start, end, limit(text), type));
            }
            if (end == last) {
                break;
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers

    private static CodeChunk newChunk(
            Long projectId,
            String path,
            String className,
            String methodName,
            int startLine,
            int endLine,
            String content,
            ChunkType type) {
        return StructureChunker.newChunk(projectId, path, className, methodName, startLine, endLine, content, type);
    }

    /** Javadoc above a method/class belongs to it, so the chunk starts at the comment. */
    private static int startLineWithComment(Node node) {
        int start = node.getRange().map(r -> r.begin.line).orElse(1);
        return node.getComment()
                .flatMap(Node::getRange)
                .map(r -> Math.min(r.begin.line, start))
                .orElse(start);
    }

    /** "Outer.Inner" for nested classes, "Outer" otherwise. */
    private static String qualifiedName(TypeDeclaration<?> type) {
        StringBuilder name = new StringBuilder(type.getNameAsString());
        Node parent = type.getParentNode().orElse(null);
        while (parent instanceof TypeDeclaration<?> outer) {
            name.insert(0, outer.getNameAsString() + ".");
            parent = outer.getParentNode().orElse(null);
        }
        return name.toString();
    }

    private String limit(String text) {
        return text.length() <= maxChunkChars ? text : text.substring(0, maxChunkChars) + "\n// ... (truncated)";
    }
}
