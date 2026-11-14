package com.repolens.indexing;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Simple chunker: file ko 60-60 line ke tukdon mein todta hai (10 line overlap).
 * Ye AST chunker jitna accha nahi, par isse indexing job bina Sakshi ke code ke test ho jaata hai.
 * Sakshi ka chunker fail ho kisi file par, tab bhi ye backup ki tarah kaam aata hai.
 */
@Component
public class FallbackLineChunker implements CodeChunker {

    private static final int WINDOW = 60;
    private static final int OVERLAP = 10;

    @Override
    public List<CodeChunk> chunk(Long projectId, String filePath, String content) {
        String[] lines = content.split("\\R", -1);
        String className = classNameFrom(filePath);
        List<CodeChunk> chunks = new ArrayList<>();

        int start = 0;
        while (start < lines.length) {
            int end = Math.min(start + WINDOW, lines.length);
            String text = String.join("\n", Arrays.copyOfRange(lines, start, end));

            if (!text.isBlank()) {
                chunks.add(new CodeChunk(
                        null, projectId, filePath, className, null, start + 1, end, text, ChunkType.FILE));
            }
            if (end == lines.length) {
                break;
            }
            start = end - OVERLAP;
        }
        return chunks;
    }

    private static String classNameFrom(String filePath) {
        String name = filePath.substring(filePath.lastIndexOf('/') + 1);
        return name.endsWith(".java") ? name.substring(0, name.length() - 5) : null;
    }
}
