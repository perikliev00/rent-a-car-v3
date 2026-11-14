-- Distinguish return-checklist auto damages from manually created reports so
-- description/cost edits update the single auto row without duplicating spend
-- or mutating manual entries (including same-description manuals).

ALTER TABLE car_damage_reports
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'car_damage_source_valid'
      AND conrelid = 'car_damage_reports'::regclass
  ) THEN
    ALTER TABLE car_damage_reports
      ADD CONSTRAINT car_damage_source_valid
      CHECK (source IN ('manual', 'return_checklist'));
  END IF;
END $$;

-- Collapse pre-fix duplicate unresolved rows that match a return checklist
-- description (keep the lowest id) before labelling them as return_checklist.
WITH ranked AS (
  SELECT
    d.id,
    ROW_NUMBER() OVER (
      PARTITION BY d.reservation_id
      ORDER BY d.id ASC
    ) AS rn
  FROM car_damage_reports d
  JOIN reservation_return_checklists c
    ON c.reservation_id = d.reservation_id
  WHERE c.new_damages IS NOT NULL
    AND btrim(c.new_damages) <> ''
    AND d.description = c.new_damages
    AND d.status = 'unresolved'
)
UPDATE car_damage_reports d
SET status = 'resolved',
    resolved_at = COALESCE(d.resolved_at, NOW()),
    updated_at = NOW()
FROM ranked
WHERE d.id = ranked.id
  AND ranked.rn > 1;

-- Backfill auto rows that were created from a matching return checklist description.
UPDATE car_damage_reports d
SET source = 'return_checklist'
FROM reservation_return_checklists c
WHERE d.reservation_id = c.reservation_id
  AND c.new_damages IS NOT NULL
  AND btrim(c.new_damages) <> ''
  AND d.description = c.new_damages
  AND d.status = 'unresolved'
  AND d.source = 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_car_damage_one_auto_unresolved_per_reservation
  ON car_damage_reports (reservation_id)
  WHERE source = 'return_checklist'
    AND status = 'unresolved'
    AND reservation_id IS NOT NULL;
