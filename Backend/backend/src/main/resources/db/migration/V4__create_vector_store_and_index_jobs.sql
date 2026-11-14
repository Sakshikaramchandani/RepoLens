-- pgvector image mein ye extensions available hain
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Spring AI PgVectorStore isi format ka table expect karta hai
CREATE TABLE vector_store (
    id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content    TEXT,
    metadata   JSON,
    embedding  VECTOR(768)
);

-- HNSW: similarity search fast karne ke liye
CREATE INDEX idx_vector_store_embedding
    ON vector_store USING hnsw (embedding vector_cosine_ops);

-- Project-wise delete/filter fast karne ke liye
CREATE INDEX idx_vector_store_project
    ON vector_store ((metadata->>'projectId'));

CREATE TABLE index_jobs (
    id               BIGSERIAL PRIMARY KEY,
    project_id       BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status           VARCHAR(20)  NOT NULL,
    progress         INT          NOT NULL DEFAULT 0,
    total_files      INT          NOT NULL DEFAULT 0,
    processed_files  INT          NOT NULL DEFAULT 0,
    total_chunks     INT          NOT NULL DEFAULT 0,
    error_message    VARCHAR(1000),
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    started_at       TIMESTAMP,
    finished_at      TIMESTAMP
);

CREATE INDEX idx_index_jobs_project ON index_jobs(project_id, id DESC);