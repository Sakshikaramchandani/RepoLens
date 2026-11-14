-- Change history per file, computed from git at import time (GitHub clones keep the last N commits;
-- a ZIP that contains its .git folder works too). Feeds the risk map: churn and bug-fix commits.
CREATE TABLE file_history (
    id               BIGSERIAL PRIMARY KEY,
    project_id       BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path             VARCHAR(1024) NOT NULL,
    commits          INT          NOT NULL,
    bug_fix_commits  INT          NOT NULL,
    authors          INT          NOT NULL,
    last_changed_at  TIMESTAMP,
    UNIQUE (project_id, path)
);

-- How many commits were read for the project (0 = no history available)
ALTER TABLE projects ADD COLUMN history_commits INT NOT NULL DEFAULT 0;
