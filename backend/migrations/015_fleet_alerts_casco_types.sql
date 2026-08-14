-- Allow casco fleet alert types

ALTER TABLE car_fleet_alerts
  DROP CONSTRAINT IF EXISTS car_fleet_alerts_type_valid;

ALTER TABLE car_fleet_alerts
  ADD CONSTRAINT car_fleet_alerts_type_valid CHECK (alert_type IN (
    'insurance_expired',
    'insurance_expiring_soon',
    'casco_expired',
    'casco_expiring_soon',
    'vignette_expired',
    'vignette_expiring_soon',
    'inspection_expired',
    'inspection_expiring_soon',
    'unresolved_damage'
  ));
