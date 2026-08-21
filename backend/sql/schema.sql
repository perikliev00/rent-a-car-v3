-- ============================================================
-- LuxRide PostgreSQL Schema (orchestrator)
-- ============================================================
--
-- Схемата е разделена в отделни файлове: sql/schema/
--
-- Прилагане:
--   node sql/applySchema.js
--
-- Или с psql (от папка sql/):
--   cd sql
--   psql "%DATABASE_URL%" -f schema.sql
--
-- Ред на зависимости:
--   001 categories
--   002 cars
--   003 car_date_blocks
--   004 users
--   005 session
--   006 reservations
--   007 orders
--   008 contacts
--   009 processed_stripe_events
--   010 car_date_blocks exclusion constraint
--   011 reservations active holds exclusion
--   012 users email lower unique
--   013 updated_at triggers
--   014 admin audit logs
--   015 payment events
--   016 payment failures
--   017 reservation status history
--   018–023 fleet management / alerts
--   024 pricing engine
--   025 customer portal
--   026 reservation checklists
--   027 rbac
--   028 calendar
--   029 notifications
--   030 notifications rbac
--   031 one active hold per session
--   032 refund operations

--
-- Legacy destructive drops (e.g. bookings) live in migrations/ only.

\ir schema/001_categories.sql
\ir schema/002_cars.sql
\ir schema/003_car_date_blocks.sql
\ir schema/004_users.sql
\ir schema/005_session.sql
\ir schema/006_reservations.sql
\ir schema/007_orders.sql
\ir schema/008_contacts.sql
\ir schema/009_processed_stripe_events.sql
\ir schema/010_car_date_blocks_exclusion.sql
\ir schema/011_reservations_active_holds_exclusion.sql
\ir schema/012_users_email_lower_unique.sql
\ir schema/013_updated_at_triggers.sql
\ir schema/014_admin_audit_logs.sql
\ir schema/015_payment_events.sql
\ir schema/016_payment_failures.sql
\ir schema/017_reservation_status_history.sql
\ir schema/018_cars_fleet_fields.sql
\ir schema/019_car_service_records.sql
\ir schema/020_car_damage_reports.sql
\ir schema/021_car_documents.sql
\ir schema/022_car_compliance_items.sql
\ir schema/023_car_fleet_alerts.sql
\ir schema/024_pricing_engine.sql
\ir schema/025_customer_portal.sql
\ir schema/026_reservation_checklists.sql
\ir schema/027_rbac.sql
\ir schema/028_calendar.sql
\ir schema/029_notifications.sql
\ir schema/030_notifications_rbac.sql
\ir schema/031_reservations_one_active_hold_per_session.sql
\ir schema/032_refund_operations.sql
