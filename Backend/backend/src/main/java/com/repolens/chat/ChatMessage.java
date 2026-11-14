package com.repolens.chat;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageRole role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** Citations JSON string mein: [{"filePath":"...","startLine":42,"endLine":60}] */
    @Column(name = "sources", columnDefinition = "TEXT")
    private String sourcesJson;

    /** Model that wrote an assistant answer; null for user messages. */
    @Column(length = 120)
    private String model;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected ChatMessage() {}

    public ChatMessage(Long conversationId, MessageRole role, String content, String sourcesJson, String model) {
        this.conversationId = conversationId;
        this.role = role;
        this.content = content;
        this.sourcesJson = sourcesJson;
        this.model = model;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public MessageRole getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public String getSourcesJson() {
        return sourcesJson;
    }

    public String getModel() {
        return model;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
