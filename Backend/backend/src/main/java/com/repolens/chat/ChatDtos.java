package com.repolens.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public final class ChatDtos {

    private ChatDtos() {}

    /**
     * conversationId null = new conversation.
     * regenerate true = answer the conversation's last question again (message is ignored,
     * the previous answer to that question is replaced).
     * Validated in ChatService, not with @Valid: errors must travel inside the SSE stream.
     */
    public record ChatRequest(Long projectId, Long conversationId, String message, Boolean regenerate) {

        public boolean isRegenerate() {
            return Boolean.TRUE.equals(regenerate);
        }
    }

    /** Citation: AuthService.java:42-60 */
    public record SourceRef(String filePath, int startLine, int endLine) {}

    /**
     * One "data:" event of the SSE stream.
     * type = token   -> text = next piece of the answer
     * type = sources -> sources = citations (once, at the end)
     * type = done    -> conversationId (stream finished); model = who answered
     * type = error   -> text = error message (a "done" always follows)
     */
    public record ChatStreamEvent(
            String type, String text, List<SourceRef> sources, Long conversationId, String model) {}

    public record ConversationSummary(
            Long id, Long projectId, String title, LocalDateTime createdAt, LocalDateTime updatedAt) {}

    /** role: USER | ASSISTANT. model: who wrote an assistant answer (null for user messages). */
    public record MessageResponse(
            Long id, String role, String content, List<SourceRef> sources, LocalDateTime createdAt, String model) {}

    public record RenameConversationRequest(
            @NotBlank(message = "Title is required") @Size(max = 200, message = "Title must be at most 200 characters")
            String title) {}
}
