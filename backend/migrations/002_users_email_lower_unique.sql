-- Case-insensitive email uniqueness at DB level.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS users_email_lower_unique;
CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email));
