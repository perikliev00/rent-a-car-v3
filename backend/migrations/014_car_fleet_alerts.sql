-- Persisted fleet alerts (insurance / vignette / GTP / unresolved damage)

CREATE TABLE IF NOT EXISTS car_fleet_alerts (
  id            BIGSERIAL PRIMARY KEY,
  car_id        BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  alert_type    VARCHAR(64) NOT NULL,
  severity      VARCHAR(16) NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'active',
  source_kind   VARCHAR(32) NOT NULL,
  source_id     BIGINT NOT NULL,
  message       TEXT NOT NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT car_fleet_alerts_severity_valid CHECK (severity IN ('critical', 'warning', 'info')),
  CONSTRAINT car_fleet_alerts_status_valid CHECK (status IN ('active', 'resolved')),
  CONSTRAINT car_fleet_alerts_source_kind_valid CHECK (source_kind IN ('compliance_item', 'damage_report')),
  CONSTRAINT car_fleet_alerts_type_valid CHECK (alert_type IN (
    'insurance_expired',
    'insurance_expiring_soon',
    'vignette_expired',
    'vignette_expiring_soon',
    'inspection_expired',
    'inspection_expiring_soon',
    'unresolved_damage'
  ))
);

CREATE INDEX IF NOT EXISTS idx_car_fleet_alerts_car_status
  ON car_fleet_alerts(car_id, status);

CREATE INDEX IF NOT EXISTS idx_car_fleet_alerts_type
  ON car_fleet_alerts(alert_type)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_car_fleet_alerts_active_dedup
  ON car_fleet_alerts(car_id, alert_type, source_kind, source_id)
  WHERE status = 'active';
