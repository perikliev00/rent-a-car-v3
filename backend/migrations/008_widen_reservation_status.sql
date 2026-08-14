-- paid_needs_manual_review is 24 characters; widen status column to fit.
ALTER TABLE reservations ALTER COLUMN status TYPE VARCHAR(32);
