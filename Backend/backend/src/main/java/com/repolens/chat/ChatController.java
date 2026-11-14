package com.repolens.chat;

import com.repolens.chat.ChatDtos.*;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api")
@Tag(name = "Chat")
public class ChatController {

    private final ChatService chatService;
    private final ConversationService conversationService;

    public ChatController(ChatService chatService, ConversationService conversationService) {
        this.chatService = chatService;
        this.conversationService = conversationService;
    }

    /**
     * No @Valid on purpose: on an SSE endpoint a validation error cannot be sent as JSON
     * (the response type is text/event-stream). ChatService validates and sends an "error" event.
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(
            summary = "RAG chat, streamed as SSE. Events: token... -> sources -> done (or error -> done). "
                    + "regenerate=true answers the conversation's last question again")
    public Flux<ChatStreamEvent> chat(@RequestBody ChatRequest request, @AuthenticationPrincipal User user) {
        return chatService.chat(request, user.getId());
    }

    @GetMapping("/projects/{id}/conversations")
    @Operation(summary = "Conversations of a project, latest first. q = search titles and messages")
    public List<ConversationSummary> conversations(
            @PathVariable Long id, @RequestParam(required = false) String q, @AuthenticationPrincipal User user) {
        return conversationService.list(id, user.getId(), q);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    @Operation(summary = "Messages of a conversation (with citations and model)")
    public List<MessageResponse> messages(@PathVariable Long conversationId, @AuthenticationPrincipal User user) {
        return conversationService.messages(conversationId, user.getId());
    }

    @PatchMapping("/conversations/{conversationId}")
    @Operation(summary = "Rename a conversation")
    public ConversationSummary rename(
            @PathVariable Long conversationId,
            @Valid @RequestBody RenameConversationRequest request,
            @AuthenticationPrincipal User user) {
        return conversationService.rename(conversationId, user.getId(), request.title());
    }

    @DeleteMapping("/conversations/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a conversation and its messages")
    public void delete(@PathVariable Long conversationId, @AuthenticationPrincipal User user) {
        conversationService.delete(conversationId, user.getId());
    }
}
