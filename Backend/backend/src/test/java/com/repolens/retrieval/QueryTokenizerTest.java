package com.repolens.retrieval;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class QueryTokenizerTest {

    @Test
    void splitsCamelCaseAndKeepsWholeName() {
        assertEquals(
                List.of("generatetoken", "generate", "token", "jwtservice", "jwt", "service"),
                QueryTokenizer.tokens("Where is generateToken in JWTService?"));
    }

    @Test
    void removesHinglishFillerWords() {
        assertEquals("login | flow", QueryTokenizer.toTsQuery(QueryTokenizer.tokens("Login ka flow kya hai?")));
    }

    @Test
    void stripsDangerousCharacters() {
        // SQL / tsquery operators kabhi query tak nahi pahunchte
        assertEquals(List.of("drop", "table"), QueryTokenizer.tokens("'; DROP TABLE x; -- | & !"));
    }

    @Test
    void onlyFillerWordsGiveEmptyList() {
        assertTrue(QueryTokenizer.tokens("kya hai ye?").isEmpty());
    }
}
