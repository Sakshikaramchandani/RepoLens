CREATE TABLE github_sources (
    id                     BIGSERIAL PRIMARY KEY,
    project_id             BIGINT        NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    repo_url               VARCHAR(500)  NOT NULL,
    repo_owner             VARCHAR(100)  NOT NULL,
    repo_name              VARCHAR(100)  NOT NULL,
    branch                 VARCHAR(200)  NOT NULL,
    latest_commit_sha      VARCHAR(64),
    latest_commit_message  VARCHAR(1000),
    encrypted_token        VARCHAR(1000),
    last_imported_at       TIMESTAMP,
    created_at             TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP     NOT NULL DEFAULT NOW()
);