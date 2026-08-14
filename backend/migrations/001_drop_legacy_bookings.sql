-- One-time upgrade: remove legacy Mongo-era bookings table if present.
-- Not part of greenfield schema apply — run only via `npm run db:migrate`.
DROP TABLE IF EXISTS bookings CASCADE;
