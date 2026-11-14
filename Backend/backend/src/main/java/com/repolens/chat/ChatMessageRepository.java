package com.repolens.chat;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByConversationIdOrderByIdAsc(Long conversationId);

    /** Latest N messages (follow-up sawal ke context ke liye) */
    List<ChatMessage> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);
}
