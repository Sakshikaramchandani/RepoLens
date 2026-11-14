package com.repolens.chat;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.retrieval.RetrievedChunk;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PromptBuilderTest {

    @Test
    void fileMapGroupsByFolderAndRespectsTheBudget() {
        String map = PromptBuilder.fileMap(List.of("src/a/One.java", "src/a/Two.java", "README.md"), 500);
        assertTrue(map.contains("src/a/: One.java, Two.java"));
        assertTrue(map.contains("./: README.md"));

        List<String> many = new ArrayList<>();
        for (int i = 0; i < 2000; i++) {
            many.add("pkg" + i + "/File" + i + ".py");
        }
        String cut = PromptBuilder.fileMap(many, 1000);
        assertTrue(cut.length() < 1100);
        assertTrue(cut.contains("more files"));
        assertEquals("(not available)", PromptBuilder.fileMap(List.of(), 100));
    }

    @Test
    void promptCarriesFileMapAndCitations() {
        PromptBuilder builder = new PromptBuilder(10_000);
        RetrievedChunk c = new RetrievedChunk("1", "app/auth.py", 3, 9, null, "login", "def login(): ...", 1, 1, 1);
        PromptBuilder.PromptParts parts =
                builder.build("How does login work?", List.of(c), List.of(), List.of("app/auth.py", "app/db.py"));
        assertTrue(parts.userPrompt().contains("PROJECT FILES"));
        assertTrue(parts.userPrompt().contains("app/: auth.py, db.py"));
        assertTrue(parts.userPrompt().contains("CITE AS [auth.py:3-9]"));
        assertEquals(1, parts.usedChunks().size());
    }
}
