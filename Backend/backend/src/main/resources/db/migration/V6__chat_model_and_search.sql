-- Which model wrote each assistant answer (e.g. "deepseek-v4-1-flash", or the Ollama fallback).
-- NULL for user messages and for answers saved before this migration.
ALTER TABLE chat_messages ADD COLUMN model VARCHAR(120);
