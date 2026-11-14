-- =========================================================
-- 1. KEYWORD SEARCH (PostgreSQL full-text search)
-- content_tsv PostgreSQL khud banata hai (GENERATED ... STORED):
--   * symbols hatao:   jwtService.generateToken(user) -> jwtService generateToken user
--   * camelCase todo:  generateToken -> generate Token, JWTService -> JWT Service
--   * dono version rakho, toh "generateToken", "token", "jwt" teeno match karenge
-- Purane chunks ka column bhi apne aap bhar jaata hai, re-index ki zaroorat nahi.
-- =========================================================
ALTER TABLE vector_store
    ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('simple'::regconfig,
            regexp_replace(coalesce(metadata->>'filePath', '') || ' ' || coalesce(content, ''),
                           '[^A-Za-z0-9]+', ' ', 'g')
            || ' ' ||
            regexp_replace(
                regexp_replace(
                    regexp_replace(coalesce(metadata->>'filePath', '') || ' ' || coalesce(content, ''),
                                   '[^A-Za-z0-9]+', ' ', 'g'),
                    '([a-z0-9])([A-Z])', '\1 \2', 'g'),
                '([A-Z])([A-Z][a-z])', '\1 \2', 'g')
        )
    ) STORED;

-- GIN index: keyword search fast rahe
CREATE INDEX idx_vector_store_tsv ON vector_store USING GIN (content_tsv);

-- =========================================================
-- 2. CHAT HISTORY
-- =========================================================
CREATE TABLE conversations (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_project_user ON conversations(project_id, user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id               BIGSERIAL PRIMARY KEY,
    conversation_id  BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             VARCHAR(20)  NOT NULL,
    content          TEXT         NOT NULL,
    sources          TEXT,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, id);