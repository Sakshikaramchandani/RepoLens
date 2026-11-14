-- email_verified: the address was proven by a provider (GitHub / Google verified email).
--   Email + password sign-up never verifies it, so it stays FALSE until an OAuth sign-in proves it.
--   When that happens on an unverified account, the account is "claimed": its password is replaced
--   (whoever registered it may not own the address) and every token issued before is revoked.
-- tokens_valid_after: JWTs issued before this moment are rejected (sign-out everywhere, account claim).
ALTER TABLE users ADD COLUMN email_verified     BOOLEAN   NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN tokens_valid_after TIMESTAMP;
