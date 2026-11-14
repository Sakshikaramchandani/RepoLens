package com.repolens.chunking;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.indexing.ChunkType;
import com.repolens.indexing.CodeChunk;
import com.repolens.indexing.CodeChunker;
import com.repolens.indexing.IndexFileFilter;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/** Plain unit tests — no Spring, no database. Right-click → Run As → JUnit Test. */
class AstCodeChunkerTest {

    private static final String PATH = "src/main/java/com/demo/UserService.java";

    // line numbers matter in these tests, so the text is built line by line
    private static final String USER_SERVICE = String.join(
            "\n",
            "package com.demo;", // 1
            "", // 2
            "import org.springframework.stereotype.Service;", // 3
            "import java.util.List;", // 4
            "", // 5
            "/** Handles users. */", // 6
            "@Service", // 7
            "public class UserService {", // 8
            "", // 9
            "    private final List<String> users = List.of();", // 10
            "", // 11
            "    public UserService() {", // 12
            "    }", // 13
            "", // 14
            "    /** Logs a user in. */", // 15
            "    @Deprecated", // 16
            "    public boolean login(String email) {", // 17
            "        return users.contains(email);", // 18
            "    }", // 19
            "", // 20
            "    public int count() {", // 21
            "        return users.size();", // 22
            "    }", // 23
            "", // 24
            "    static class Cache {", // 25
            "        void clear() {", // 26
            "        }", // 27
            "    }", // 28
            "}"); // 29

    private final AstCodeChunker chunker = new AstCodeChunker();

    @Test
    void cutsAClassIntoClassAndMethodChunks() {
        List<CodeChunk> chunks = chunker.chunk(1L, PATH, USER_SERVICE);

        // UserService: 1 CLASS + constructor + login + count; Cache: 1 CLASS + clear
        assertEquals(6, chunks.size(), describe(chunks));
        assertEquals(2, chunks.stream().filter(c -> c.type() == ChunkType.CLASS).count());
        assertEquals(
                4, chunks.stream().filter(c -> c.type() == ChunkType.METHOD).count());
    }

    @Test
    void methodChunkHasCorrectLinesJavadocAndAnnotations() {
        CodeChunk login = find(chunker.chunk(1L, PATH, USER_SERVICE), "login");

        assertEquals("UserService", login.className());
        assertEquals(15, login.startLine(), "starts at the javadoc above the method");
        assertEquals(19, login.endLine());
        assertTrue(login.content().contains("return users.contains(email);"));
        assertTrue(login.content().startsWith("    /** Logs a user in. */"));
        assertTrue(login.content().contains("@Deprecated"), "annotations are part of the method chunk");
        assertEquals(PATH, login.filePath());
        assertEquals(1L, login.projectId());
    }

    @Test
    void classChunkIsAnOverviewWithoutMethodBodies() {
        CodeChunk cls = chunker.chunk(1L, PATH, USER_SERVICE).stream()
                .filter(c -> c.type() == ChunkType.CLASS && c.className().equals("UserService"))
                .findFirst()
                .orElseThrow();

        assertEquals(6, cls.startLine());
        assertEquals(29, cls.endLine());
        assertNull(cls.methodName());
        assertTrue(cls.content().contains("@Service"), "class annotations are kept");
        assertTrue(cls.content().contains("login(String email)"), "method signature is kept");
        assertFalse(cls.content().contains("users.contains(email)"), "method body is removed");
        assertFalse(cls.content().contains("class Cache"), "nested class gets its own chunk");
    }

    @Test
    void nestedClassesAreNamedOuterDotInner() {
        CodeChunk clear = find(chunker.chunk(1L, PATH, USER_SERVICE), "clear");
        assertEquals("UserService.Cache", clear.className());
        assertEquals(26, clear.startLine());
        assertEquals(27, clear.endLine());
    }

    @Test
    void longMethodsAreSplitWithOverlap() {
        // method of 1 + 25 + 1 = 27 lines; limit 10 lines, overlap 2 → parts start every 8 lines
        String body = IntStream.rangeClosed(1, 25)
                .mapToObj(i -> "        int v" + i + " = " + i + ";")
                .collect(Collectors.joining("\n"));
        String code = "class Big {\n    void huge() {\n" + body + "\n    }\n}";

        List<CodeChunk> parts = new AstCodeChunker(10, 80, 2, 6000)
                .chunk(1L, "src/main/java/Big.java", code).stream()
                        .filter(c -> "huge".equals(c.methodName()))
                        .toList();

        assertEquals(4, parts.size(), describe(parts));
        assertEquals(2, parts.get(0).startLine());
        assertEquals(11, parts.get(0).endLine());
        assertEquals(10, parts.get(1).startLine(), "2 lines overlap with the previous part");
        assertEquals(28, parts.get(parts.size() - 1).endLine());
        parts.forEach(p -> assertTrue(p.endLine() - p.startLine() + 1 <= 10));
    }

    @Test
    void recordsEnumsAndInterfacesAreChunked() {
        String code = String.join(
                "\n",
                "public record LoginRequest(String email, String password) {",
                "    public boolean valid() { return email != null; }",
                "}",
                "enum Role { USER, ADMIN }",
                "interface Repo { void save(); }");

        List<CodeChunk> chunks = chunker.chunk(1L, "src/main/java/LoginRequest.java", code);

        assertTrue(chunks.stream().anyMatch(c -> "LoginRequest".equals(c.className()) && c.type() == ChunkType.CLASS));
        assertTrue(chunks.stream().anyMatch(c -> "valid".equals(c.methodName())));
        assertTrue(chunks.stream().anyMatch(c -> "Role".equals(c.className())));
        assertTrue(chunks.stream().anyMatch(c -> "save".equals(c.methodName())), "interface methods too");
    }

    @Test
    void brokenJavaFallsBackToStructureChunks() {
        String broken = "public class Broken {\n    void x( {\n}";
        List<CodeChunk> chunks = chunker.chunk(1L, "src/main/java/Broken.java", broken);

        // JavaParser fails; the structure patterns still find the class, nothing is lost
        assertEquals(1, chunks.size());
        assertEquals("Broken", chunks.get(0).className());
        assertEquals(1, chunks.get(0).startLine());
        assertEquals(3, chunks.get(0).endLine());
    }

    @Test
    void configFilesBecomeFileChunks() {
        String yml = IntStream.rangeClosed(1, 100)
                .mapToObj(i -> "key" + i + ": " + i)
                .collect(Collectors.joining("\n"));

        List<CodeChunk> chunks = chunker.chunk(1L, "src/main/resources/application.yml", yml);

        assertEquals(2, chunks.size(), "80 lines + the remaining lines with 10 overlap");
        assertEquals(1, chunks.get(0).startLine());
        assertEquals(80, chunks.get(0).endLine());
        assertEquals(71, chunks.get(1).startLine());
        assertEquals(100, chunks.get(1).endLine());
        assertNull(chunks.get(0).className());
    }

    @Test
    void skippedFilesGiveNoChunks() {
        assertTrue(chunker.chunk(1L, "src/test/java/com/demo/UserServiceTest.java", USER_SERVICE)
                .isEmpty());
        assertTrue(chunker.chunk(1L, "package-lock.json", "{}").isEmpty());
        assertTrue(chunker.chunk(1L, PATH, "   ").isEmpty());
        assertTrue(
                chunker.chunk(1L, PATH, "@Generated(\"mapstruct\")\nclass X {}").isEmpty());
    }

    @Test
    void idsAreStableAndUnique() {
        List<CodeChunk> first = chunker.chunk(1L, PATH, USER_SERVICE);
        List<CodeChunk> second = chunker.chunk(1L, PATH, USER_SERVICE);

        assertEquals(
                first.stream().map(CodeChunk::id).toList(),
                second.stream().map(CodeChunk::id).toList());
        assertEquals(first.size(), first.stream().map(CodeChunk::id).distinct().count());
    }

    @Test
    void plugsIntoApoorvsIndexingJob() {
        // IndexWorker asks Spring for "a CodeChunker"; this class is one (and @Primary)
        CodeChunker asInterface = chunker;
        assertFalse(asInterface.chunk(1L, PATH, USER_SERVICE).isEmpty());
        assertNotNull(AstCodeChunker.class.getAnnotation(org.springframework.context.annotation.Primary.class));
    }

    @Test
    void jobFilterUsesTheSameRules() {
        IndexFileFilter filter = new IndexFileFilter();
        assertTrue(filter.shouldIndex(PATH));
        assertTrue(filter.shouldIndex("pom.xml"));
        assertFalse(filter.shouldIndex("target/classes/App.java"));
        assertFalse(filter.shouldIndex("src/main/java/UserServiceIT.java"));
    }

    // ---------------------------------------------------------------- helpers

    private static CodeChunk find(List<CodeChunk> chunks, String methodName) {
        return chunks.stream()
                .filter(c -> methodName.equals(c.methodName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no chunk for " + methodName + ": " + describe(chunks)));
    }

    private static String describe(List<CodeChunk> chunks) {
        return chunks.stream()
                .map(c ->
                        c.type() + " " + c.className() + "." + c.methodName() + " " + c.startLine() + "-" + c.endLine())
                .collect(Collectors.joining(", "));
    }
}
