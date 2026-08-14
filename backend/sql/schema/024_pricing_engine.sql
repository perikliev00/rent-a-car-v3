-- Pricing engine config + booking price snapshots

CREATE TABLE IF NOT EXISTS pricing_seasons (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  start_month   SMALLINT NOT NULL,
  start_day     SMALLINT NOT NULL,
  end_month     SMALLINT NOT NULL,
  end_day       SMALLINT NOT NULL,
  adj_type      VARCHAR(32) NOT NULL DEFAULT 'percent',
  adj_value     NUMERIC(10,2) NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_seasons_adj_type_valid CHECK (adj_type IN ('percent', 'fixed_per_day')),
  CONSTRAINT pricing_seasons_month_valid CHECK (
    start_month BETWEEN 1 AND 12 AND end_month BETWEEN 1 AND 12
  ),
  CONSTRAINT pricing_seasons_day_valid CHECK (
    start_day BETWEEN 1 AND 31 AND end_day BETWEEN 1 AND 31
  )
);

CREATE TABLE IF NOT EXISTS pricing_weekend_rules (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL DEFAULT 'Weekend',
  weekdays      SMALLINT[] NOT NULL DEFAULT ARRAY[5, 6, 0],
  adj_type      VARCHAR(32) NOT NULL DEFAULT 'percent',
  adj_value     NUMERIC(10,2) NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_weekend_adj_type_valid CHECK (adj_type IN ('percent', 'fixed_per_day'))
);

CREATE TABLE IF NOT EXISTS pricing_discount_rules (
  id            BIGSERIAL PRIMARY KEY,
  kind          VARCHAR(32) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  threshold     INTEGER NOT NULL DEFAULT 0,
  adj_type      VARCHAR(32) NOT NULL DEFAULT 'percent',
  adj_value     NUMERIC(10,2) NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_discount_kind_valid CHECK (
    kind IN ('long_rental', 'early_booking', 'last_minute')
  ),
  CONSTRAINT pricing_discount_adj_type_valid CHECK (adj_type IN ('percent', 'fixed'))
);

CREATE TABLE IF NOT EXISTS pricing_deposit_rules (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL DEFAULT 'Default deposit',
  default_amount  NUMERIC(10,2) NOT NULL DEFAULT 300,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_delivery_fees (
  location_id   VARCHAR(64) PRIMARY KEY,
  fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_global_fees (
  fee_key       VARCHAR(64) PRIMARY KEY,
  label         VARCHAR(120) NOT NULL,
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  mode          VARCHAR(32) NOT NULL DEFAULT 'flat',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_global_fees_mode_valid CHECK (mode IN ('flat', 'per_day'))
);

CREATE TABLE IF NOT EXISTS pricing_extras (
  id            BIGSERIAL PRIMARY KEY,
  code          VARCHAR(64) NOT NULL UNIQUE,
  label         VARCHAR(120) NOT NULL,
  mode          VARCHAR(32) NOT NULL DEFAULT 'flat',
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_extras_mode_valid CHECK (mode IN ('flat', 'per_day'))
);

INSERT INTO pricing_delivery_fees (location_id, fee) VALUES
  ('office', 0),
  ('sunny-beach', 25),
  ('sveti-vlas', 30),
  ('nesebar', 30),
  ('burgas', 40),
  ('burgas-airport', 50),
  ('sofia', 100),
  ('sofia-airport', 120),
  ('varna', 80),
  ('varna-airport', 90),
  ('plovdiv', 70),
  ('eleni', 35),
  ('ravda', 20)
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO pricing_global_fees (fee_key, label, amount, mode, active) VALUES
  ('hotel_delivery', 'Hotel delivery', 35, 'flat', TRUE),
  ('late_return', 'Late return fee', 50, 'flat', TRUE),
  ('fuel', 'Fuel fee', 40, 'flat', TRUE)
ON CONFLICT (fee_key) DO NOTHING;

INSERT INTO pricing_extras (code, label, mode, amount, active, sort_order) VALUES
  ('child_seat', 'Child seat', 'per_day', 5, TRUE, 10),
  ('additional_driver', 'Additional driver', 'flat', 25, TRUE, 20),
  ('insurance_basic', 'Basic insurance', 'flat', 30, TRUE, 30),
  ('insurance_full', 'Full insurance', 'flat', 60, TRUE, 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pricing_deposit_rules (name, default_amount, active)
SELECT 'Default deposit', 300, TRUE
WHERE NOT EXISTS (SELECT 1 FROM pricing_deposit_rules);

INSERT INTO pricing_weekend_rules (name, weekdays, adj_type, adj_value, active)
SELECT 'Weekend premium', ARRAY[5, 6, 0]::SMALLINT[], 'percent', 10, FALSE
WHERE NOT EXISTS (SELECT 1 FROM pricing_weekend_rules);

INSERT INTO pricing_discount_rules (kind, name, threshold, adj_type, adj_value, active)
SELECT * FROM (VALUES
  ('long_rental'::varchar, 'Long rental discount'::varchar, 14, 'percent'::varchar, 10::numeric, FALSE),
  ('early_booking', 'Early booking discount', 30, 'percent', 5, FALSE),
  ('last_minute', 'Last-minute surcharge', 3, 'percent', 10, FALSE)
) AS v(kind, name, threshold, adj_type, adj_value, active)
WHERE NOT EXISTS (SELECT 1 FROM pricing_discount_rules);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS price_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hotel_delivery BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS price_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hotel_delivery BOOLEAN NOT NULL DEFAULT FALSE;
