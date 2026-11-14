-- Profile: a username and a picture. Pictures come from GitHub / Google sign-in (an external URL)
-- or are uploaded (stored in user_avatars, served at /api/avatars/{token}).
ALTER TABLE users ADD COLUMN username          VARCHAR(30);
ALTER TABLE users ADD COLUMN avatar_url        VARCHAR(1000);
-- NULL = never set (sign-in may import one) | GITHUB | GOOGLE | UPLOAD | NONE (removed on purpose)
ALTER TABLE users ADD COLUMN avatar_source     VARCHAR(20);
ALTER TABLE users ADD COLUMN google_avatar_url VARCHAR(1000);

-- Existing accounts: username = the email's local part, cleaned; duplicates get "-<id>"
WITH cleaned AS (
    SELECT id,
           LEFT(regexp_replace(regexp_replace(split_part(email, '@', 1), '[^A-Za-z0-9._-]', '', 'g'),
                               '^[._-]+', ''), 24) AS base
    FROM users
), named AS (
    SELECT id,
           CASE WHEN length(base) < 3 THEN 'user' || id ELSE base END AS base
    FROM cleaned
), numbered AS (
    SELECT id, base, ROW_NUMBER() OVER (PARTITION BY lower(base) ORDER BY id) AS n
    FROM named
)
UPDATE users u
SET username = CASE WHEN numbered.n = 1 THEN numbered.base ELSE numbered.base || '-' || u.id END
FROM numbered
WHERE u.id = numbered.id;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));

CREATE TABLE user_avatars (
    user_id       BIGINT       PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token         VARCHAR(64)  NOT NULL UNIQUE,
    content_type  VARCHAR(40)  NOT NULL,
    data          BYTEA        NOT NULL,
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
