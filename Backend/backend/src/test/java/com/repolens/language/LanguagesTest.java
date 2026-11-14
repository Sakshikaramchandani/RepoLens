package com.repolens.language;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class LanguagesTest {

    @Test
    void detectsByExtensionAndFileName() {
        assertEquals(Language.PYTHON, Languages.detect("a/b/c.py").orElseThrow());
        assertEquals(Language.TYPESCRIPT, Languages.detect("src/App.TSX").orElseThrow());
        assertEquals(Language.GO, Languages.detect("main.go").orElseThrow());
        assertEquals(Language.DOCKERFILE, Languages.detect("deploy/Dockerfile").orElseThrow());
        assertEquals(Language.DOCKERFILE, Languages.detect("Dockerfile.dev").orElseThrow());
        assertEquals(Language.RUBY, Languages.detect("Gemfile").orElseThrow());
        assertEquals(Language.REQUIREMENTS, Languages.detect("requirements.txt").orElseThrow());
        assertEquals(Language.CSHARP, Languages.detect("src\\Program.cs").orElseThrow());
        assertTrue(Languages.detect("photo.png").isEmpty());
        assertTrue(Languages.detect("notes.txt").isEmpty());
        assertTrue(Languages.detect("LICENSE").isEmpty());
    }

    @Test
    void stripsCommentsAndStringsButKeepsLines() {
        String java = "int a = 1; // if (x) {\n/* while { */ String s = \"for {\";\nchar c = '{';";
        String stripped = CodeText.strip(java, Language.Syntax.C_LIKE);
        assertEquals(java.split("\n").length, stripped.split("\n").length);
        assertFalse(stripped.contains("if"));
        assertFalse(stripped.contains("while"));
        assertFalse(stripped.contains("for"));
        assertFalse(stripped.contains("{"));

        String py = "x = 1  # if y:\ns = \"\"\"\nfor a in b:\n\"\"\"\nif x:\n    pass";
        String strippedPy = CodeText.strip(py, Language.Syntax.HASH);
        assertEquals(py.split("\n", -1).length, strippedPy.split("\n", -1).length);
        assertEquals(1, strippedPy.split("\\bif\\b", -1).length - 1, "only the real if is left");
        assertFalse(strippedPy.contains("for a in b"));
        assertEquals(3, CodeText.codeLines(CodeText.strip("a = 1\n# comment\n\nb = 2\nc()", Language.Syntax.HASH)));
    }
}
