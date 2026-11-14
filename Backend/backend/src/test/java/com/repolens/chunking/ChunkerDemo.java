package com.repolens.chunking;

import com.repolens.indexing.CodeChunk;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Try the chunker on a real file: right-click → Run As → Java Application.
 * Change FILE to any .java file on your laptop (Apoorv's ProjectService.java is a good one).
 */
public class ChunkerDemo {

    private static final String FILE = "src/main/java/com/repolens/project/ProjectService.java";

    public static void main(String[] args) throws Exception {
        Path path = Path.of(args.length > 0 ? args[0] : FILE);
        String code = Files.readString(path);

        List<CodeChunk> chunks = new AstCodeChunker().chunk(1L, path.toString(), code);

        System.out.println(chunks.size() + " chunks from " + path);
        for (CodeChunk c : chunks) {
            System.out.printf(
                    "%-6s %-25s %-20s lines %3d-%-3d%n",
                    c.type(), c.className(), c.methodName() == null ? "-" : c.methodName(), c.startLine(), c.endLine());
        }
    }
}
