package com.repolens.review;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.repolens.common.ApiException;
import com.repolens.file.RepoFile;
import com.repolens.project.SourceType;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ReviewParserTest {

    private final ReviewParser parser = new ReviewParser(new ObjectMapper());

    private static ReviewService.FileForReview file(long id, String path, int lines) {
        RepoFile f = new RepoFile(1L, path, path.substring(path.lastIndexOf('/') + 1), "java", 100, SourceType.ZIP);
        ReflectionTestUtils.setField(f, "id", id);
        return new ReviewService.FileForReview(f, "", lines, false);
    }

    private final Map<String, ReviewService.FileForReview> files = Map.of(
            "src/main/java/a/AuthService.java", file(11, "src/main/java/a/AuthService.java", 80),
            "src/main/java/a/UserController.java", file(12, "src/main/java/a/UserController.java", 40));

    @Test
    void parsesFencedJsonNormalisesAndSortsBySeverity() {
        String answer = """
                Here is my review:
                ```json
                {"summary":"Mostly fine.","issues":[
                  {"severity":"low","category":"maintainability","file":"src/main/java/a/UserController.java","line":5,"issue":"Long method","suggestion":"Split it"},
                  {"severity":"CRITICAL","category":"SECURITY","file":"AuthService.java","line":42,"issue":"Password logged","suggestion":"Remove log"}
                ]}
                ```
                """;

        ReviewParser.Parsed parsed = parser.parse(answer, files);

        assertEquals("Mostly fine.", parsed.summary());
        assertEquals(2, parsed.issues().size());
        assertEquals("CRITICAL", parsed.issues().get(0).severity());
        assertEquals(
                "src/main/java/a/AuthService.java", parsed.issues().get(0).file(), "short name resolved to full path");
        assertEquals(11L, parsed.issues().get(0).fileId());
        assertEquals("LOW", parsed.issues().get(1).severity());
        assertEquals("MAINTAINABILITY", parsed.issues().get(1).category());
    }

    @Test
    void dropsInventedFilesAndClampsLines() {
        String answer = """
                {"issues":[
                  {"severity":"HIGH","category":"BUG","file":"NotReviewed.java","line":3,"issue":"x","suggestion":"y"},
                  {"severity":"HIGH","category":"WHATEVER","file":"src/main/java/a/UserController.java","line":999,"issue":"Off by one","suggestion":"Fix"},
                  {"severity":"HIGH","category":"BUG","file":"src/main/java/a/UserController.java","line":2,"issue":"","suggestion":"empty issue"}
                ]}""";

        ReviewParser.Parsed parsed = parser.parse(answer, files);

        assertEquals(1, parsed.issues().size());
        assertEquals(0, parsed.issues().get(0).line(), "line outside the file becomes 0 (whole file)");
        assertEquals("MAINTAINABILITY", parsed.issues().get(0).category());
    }

    @Test
    void unreadableAnswerIsAClearError() {
        assertThrows(ApiException.class, () -> parser.parse("Sorry, I can't do that.", files));
        assertThrows(ApiException.class, () -> parser.parse(null, files));
    }

    @Test
    void numberedKeepsLineNumbersAndTruncates() {
        RepoFile f = new RepoFile(1L, "A.java", "A.java", "java", 10, SourceType.ZIP);
        ReviewService.FileForReview r = ReviewService.numbered(f, "class A {\n  int x;\n}\n", 1000);
        assertTrue(r.numberedContent().startsWith("1| class A {\n2|   int x;\n3| }"));
        assertFalse(r.truncated());

        ReviewService.FileForReview cut = ReviewService.numbered(f, "a\nb\nc\nd\n", 10); // "1| a\n2| b\n" = 10 chars
        assertTrue(cut.truncated());
        assertEquals(2, cut.lineCount());
    }
}
