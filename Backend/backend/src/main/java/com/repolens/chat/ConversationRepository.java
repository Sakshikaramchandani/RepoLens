package com.repolens.chat;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    List<Conversation> findByProjectIdAndUserIdOrderByUpdatedAtDesc(Long projectId, Long userId);

    // Ownership: conversation id must match AND belong to this user
    Optional<Conversation> findByIdAndUserId(Long id, Long userId);

    /** Title or any message contains the pattern (case-insensitive). Pattern is pre-escaped by the caller. */
    @Query(value = """
            SELECT c.* FROM conversations c
            WHERE c.project_id = :projectId
              AND c.user_id = :userId
              AND (c.title ILIKE :pattern
                   OR EXISTS (SELECT 1 FROM chat_messages m
                              WHERE m.conversation_id = c.id AND m.content ILIKE :pattern))
            ORDER BY c.updated_at DESC
            LIMIT 100
            """, nativeQuery = true)
    List<Conversation> search(
            @Param("projectId") Long projectId, @Param("userId") Long userId, @Param("pattern") String pattern);
}
