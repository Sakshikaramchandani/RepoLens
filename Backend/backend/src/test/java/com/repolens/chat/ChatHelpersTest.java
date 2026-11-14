package com.repolens.chat;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class ChatHelpersTest {

    @Test
    void shortFollowUpBorrowsPreviousQuestionForRetrieval() {
        List<ChatMessage> history = List.of(
                new ChatMessage(1L, MessageRole.USER, "How does JwtService create tokens?", null, null),
                new ChatMessage(1L, MessageRole.ASSISTANT, "It signs...", "[]", "m"));

        assertEquals(
                "How does JwtService create tokens?\nAnd how long are they valid?",
                ChatService.retrievalQuery("And how long are they valid?", history));
    }

    @Test
    void longOrFirstQuestionIsUsedAsIs() {
        String longQuestion = "Explain in detail how the indexing job chooses files, chunks them and stores embeddings";
        assertEquals(
                longQuestion,
                ChatService.retrievalQuery(
                        longQuestion, List.of(new ChatMessage(1L, MessageRole.USER, "earlier", null, null))));
        assertEquals("short?", ChatService.retrievalQuery("short?", List.of()));
    }

    @Test
    void searchPatternEscapesWildcards() {
        assertEquals("%50\\% off\\_now%", ConversationService.likePattern("  50% off_now "));
        assertEquals("%a\\\\b%", ConversationService.likePattern("a\\b"));
    }

    @Test
    void titleIsCollapsedAndShortened() {
        assertEquals("Hello world", ConversationService.makeTitle("  Hello \n  world "));
        String title = ConversationService.makeTitle("x".repeat(100));
        assertEquals(61, title.length());
        assertTrue(title.endsWith("…"));
    }
}
