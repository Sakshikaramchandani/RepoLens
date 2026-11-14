-- One GitHub account per RepoLens user, connected via OAuth. The access token is AES-GCM encrypted
-- (TokenEncryptor) and never leaves the backend.
CREATE TABLE github_connections (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    github_login     VARCHAR(100) NOT NULL,
    avatar_url       VARCHAR(500),
    encrypted_token  TEXT         NOT NULL,
    scopes           VARCHAR(300),
    connected_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);
