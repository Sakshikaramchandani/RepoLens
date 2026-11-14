CREATE TABLE projects (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  VARCHAR(500),
    source_type  VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    owner_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);

CREATE TABLE repo_files (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path        VARCHAR(1000) NOT NULL,
    file_name   VARCHAR(255)  NOT NULL,
    extension   VARCHAR(20)   NOT NULL,
    size_bytes  BIGINT        NOT NULL,
    source      VARCHAR(20)   NOT NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_repo_files_project_path UNIQUE (project_id, path)
);

CREATE INDEX idx_repo_files_project ON repo_files(project_id);