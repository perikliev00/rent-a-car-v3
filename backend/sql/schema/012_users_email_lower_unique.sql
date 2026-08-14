-- Case-insensitive email uniqueness at DB level.
DROP INDEX IF EXISTS users_email_lower_unique;
CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email));
