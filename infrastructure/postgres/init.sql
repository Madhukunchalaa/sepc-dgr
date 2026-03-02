-- ═══════════════════════════════════════════════════════════════
--  DGR PLATFORM — PostgreSQL Schema
--  Run via: psql -U dgr_user -d dgr_platform -f init.sql
-- ═══════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────
--  PLANTS
-- ─────────────────────────────────────────────────
CREATE TABLE plants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  short_name      VARCHAR(50)  NOT NULL,
  location        VARCHAR(200),
  company_name    VARCHAR(200) NOT NULL,
  document_number VARCHAR(100),
  capacity_mw     DECIMAL(10,4) NOT NULL,
  plf_base_mw     DECIMAL(10,4) NOT NULL,
  fy_start_month  SMALLINT DEFAULT 4,   -- April
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
--  PLANT CONFIGURATION (key-value per plant)
-- ─────────────────────────────────────────────────
CREATE TABLE plant_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  config_key  VARCHAR(100) NOT NULL,
  config_val  TEXT,
  data_type   VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  updated_by  UUID,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, config_key)
);

-- ─────────────────────────────────────────────────
--  METER POINTS (per plant)
-- ─────────────────────────────────────────────────
CREATE TABLE meter_points (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id       UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  meter_code     VARCHAR(50)  NOT NULL,
  meter_name     VARCHAR(200) NOT NULL,
  multiplier     DECIMAL(12,6) NOT NULL DEFAULT 1,
  meter_type     VARCHAR(20) CHECK (meter_type IN ('import','export','generation')),
  uom            VARCHAR(20) DEFAULT 'MU',
  sort_order     SMALLINT DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  UNIQUE(plant_id, meter_code)
);

-- ─────────────────────────────────────────────────
--  ACTIVE FUEL TYPES (per plant)
-- ─────────────────────────────────────────────────
CREATE TABLE plant_fuels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  fuel_type   VARCHAR(30) NOT NULL CHECK (fuel_type IN ('coal','ldo','hfo','gas','biomass')),
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(plant_id, fuel_type)
);

-- ─────────────────────────────────────────────────
--  SCADA COLUMN MAPPINGS (per plant)
-- ─────────────────────────────────────────────────
CREATE TABLE scada_mappings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id          UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  scada_column      VARCHAR(200) NOT NULL,
  portal_field      VARCHAR(200) NOT NULL,
  transform_formula VARCHAR(500),  -- e.g. "value / 1000 * 0.72"
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, scada_column)
);

-- ─────────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     VARCHAR(200) NOT NULL,
  employee_id   VARCHAR(50),
  role          VARCHAR(30) NOT NULL CHECK (role IN ('operator','shift_in_charge','plant_admin','hq_management','it_admin')),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
--  USER ↔ PLANT ACCESS
-- ─────────────────────────────────────────────────
CREATE TABLE user_plants (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plant_id   UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, plant_id)
);

-- ─────────────────────────────────────────────────
--  REFRESH TOKENS
-- ─────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
--  DAILY POWER READINGS
-- ─────────────────────────────────────────────────
CREATE TABLE daily_power (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id         UUID NOT NULL REFERENCES plants(id),
  entry_date       DATE NOT NULL,
  -- Raw meter readings (stored as JSON for flexibility across plants)
  meter_readings   JSONB NOT NULL DEFAULT '{}',
  -- Computed generation values
  generation_mu    DECIMAL(12,6),   -- Daily generation MU
  generation_mtd   DECIMAL(12,6),
  generation_ytd   DECIMAL(12,6),
  avg_load_mw      DECIMAL(10,4),
  export_mu        DECIMAL(12,6),
  import_mu        DECIMAL(12,6),
  apc_mu           DECIMAL(12,6),   -- Auxiliary Power Consumption
  apc_pct          DECIMAL(6,4),
  plf_daily        DECIMAL(6,4),
  plf_mtd          DECIMAL(6,4),
  plf_ytd          DECIMAL(6,4),
  paf_sepc         DECIMAL(6,4),    -- Plant Availability Factor
  paf_tnpdcl       DECIMAL(6,4),
  hours_on_grid    DECIMAL(6,2),
  freq_min         DECIMAL(7,3),
  freq_max         DECIMAL(7,3),
  freq_avg         DECIMAL(7,3),
  forced_outages   SMALLINT DEFAULT 0,
  planned_outages  SMALLINT DEFAULT 0,
  rsd_count        SMALLINT DEFAULT 0,
  outage_remarks   TEXT,
  -- Entry metadata
  entry_method     VARCHAR(20) DEFAULT 'manual' CHECK (entry_method IN ('manual','scada_upload')),
  submitted_by     UUID REFERENCES users(id),
  approved_by      UUID REFERENCES users(id),
  status           VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','locked')),
  submitted_at     TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  DAILY FUEL DATA
-- ─────────────────────────────────────────────────
CREATE TABLE daily_fuel (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id            UUID NOT NULL REFERENCES plants(id),
  entry_date          DATE NOT NULL,
  -- Coal
  coal_receipt_mt     DECIMAL(12,3),
  coal_cons_mt        DECIMAL(12,3),
  coal_stock_mt       DECIMAL(12,3),
  coal_gcv_ar         DECIMAL(10,2),   -- As Received kcal/kg
  coal_gcv_af         DECIMAL(10,2),   -- As Fired kcal/kg
  scc_kg_kwh          DECIMAL(8,4),    -- Specific Coal Consumption
  -- LDO
  ldo_receipt_kl      DECIMAL(10,3),
  ldo_cons_kl         DECIMAL(10,3),
  ldo_stock_kl        DECIMAL(10,3),
  ldo_rate            DECIMAL(12,2),
  -- HFO
  hfo_receipt_kl      DECIMAL(10,3),
  hfo_cons_kl         DECIMAL(10,3),
  hfo_stock_kl        DECIMAL(10,3),
  hfo_rate            DECIMAL(12,2),
  soc_ml_kwh          DECIMAL(8,4),    -- Specific Oil Consumption
  -- Gases (cylinders)
  h2_receipt          SMALLINT DEFAULT 0,
  h2_cons             SMALLINT DEFAULT 0,
  h2_stock            SMALLINT DEFAULT 0,
  co2_receipt         SMALLINT DEFAULT 0,
  co2_cons            SMALLINT DEFAULT 0,
  co2_stock           SMALLINT DEFAULT 0,
  n2_receipt          SMALLINT DEFAULT 0,
  n2_cons             SMALLINT DEFAULT 0,
  n2_stock            SMALLINT DEFAULT 0,
  -- Metadata
  submitted_by        UUID REFERENCES users(id),
  approved_by         UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'draft',
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  DAILY PERFORMANCE
-- ─────────────────────────────────────────────────
CREATE TABLE daily_performance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id        UUID NOT NULL REFERENCES plants(id),
  entry_date      DATE NOT NULL,
  ghr_direct      DECIMAL(10,2),   -- Gross Heat Rate kcal/kWh (Direct)
  ghr_mtd         DECIMAL(10,2),
  ghr_ytd         DECIMAL(10,2),
  gcv_ar          DECIMAL(10,2),   -- GCV As Received
  gcv_af          DECIMAL(10,2),   -- GCV As Fired
  loi_ba          DECIMAL(6,3),    -- Loss on Ignition - Bottom Ash
  loi_fa          DECIMAL(6,3),    -- Loss on Ignition - Fly Ash
  fc_pct          DECIMAL(6,3),    -- Fixed Carbon %
  vm_pct          DECIMAL(6,3),    -- Volatile Matter %
  fc_vm_ratio     DECIMAL(8,4),
  mill_sieve_a    DECIMAL(6,3),    -- Mill Sieve 200 mesh % Mill A
  mill_sieve_b    DECIMAL(6,3),
  mill_sieve_c    DECIMAL(6,3),
  submitted_by    UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'draft',
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  DAILY WATER
-- ─────────────────────────────────────────────────
CREATE TABLE daily_water (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id            UUID NOT NULL REFERENCES plants(id),
  entry_date          DATE NOT NULL,
  dm_generation_m3    DECIMAL(12,3),
  dm_cycle_makeup_m3  DECIMAL(12,3),
  dm_cycle_pct        DECIMAL(6,3),
  dm_total_cons_m3    DECIMAL(12,3),
  dm_stock_m3         DECIMAL(12,3),
  service_water_m3    DECIMAL(12,3),
  potable_water_m3    DECIMAL(12,3),
  sea_water_m3        DECIMAL(12,3),
  submitted_by        UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'draft',
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  DAILY AVAILABILITY
-- ─────────────────────────────────────────────────
CREATE TABLE daily_availability (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id            UUID NOT NULL REFERENCES plants(id),
  entry_date          DATE NOT NULL,
  on_bar_hours        DECIMAL(6,3),
  rsd_hours           DECIMAL(6,3),
  forced_outage_hrs   DECIMAL(6,3),
  planned_outage_hrs  DECIMAL(6,3),
  paf_pct             DECIMAL(6,4),
  paf_mtd             DECIMAL(6,4),
  paf_ytd             DECIMAL(6,4),
  submitted_by        UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'draft',
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  DAILY SCHEDULING (DC / SG)
-- ─────────────────────────────────────────────────
CREATE TABLE daily_scheduling (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id        UUID NOT NULL REFERENCES plants(id),
  entry_date      DATE NOT NULL,
  dc_sepc_mu      DECIMAL(12,6),
  dc_tnpdcl_mu    DECIMAL(12,6),
  sg_ppa_mu       DECIMAL(12,6),
  sg_dam_mu       DECIMAL(12,6),
  sg_rtm_mu       DECIMAL(12,6),
  urs_dam_mwh     DECIMAL(12,3),
  urs_rtm_mwh     DECIMAL(12,3),
  urs_revenue     DECIMAL(14,2),
  remarks         TEXT,
  submitted_by    UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'draft',
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  OPERATIONS LOG
-- ─────────────────────────────────────────────────
CREATE TABLE operations_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id            UUID NOT NULL REFERENCES plants(id),
  entry_date          DATE NOT NULL,
  boiler_activities   TEXT,
  turbine_activities  TEXT,
  electrical_activities TEXT,
  bop_activities      TEXT,
  running_equipment   JSONB DEFAULT '{}',
  outage_details      JSONB DEFAULT '[]',
  submitted_by        UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'draft',
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

-- ─────────────────────────────────────────────────
--  TRIP EVENTS
-- ─────────────────────────────────────────────────
CREATE TABLE trip_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id          UUID NOT NULL REFERENCES plants(id),
  unit_no           SMALLINT DEFAULT 1,
  capacity_mw       DECIMAL(10,4),
  trip_datetime     TIMESTAMPTZ NOT NULL,
  sync_datetime     TIMESTAMPTZ,
  trip_reason       TEXT,
  outage_days       DECIMAL(8,4),   -- auto-computed
  outage_hhmm       VARCHAR(10),    -- auto-computed "HH:MM"
  is_continued      BOOLEAN DEFAULT FALSE,
  entered_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
--  COAL RECEIPTS (Reconciliation)
-- ─────────────────────────────────────────────────
CREATE TABLE coal_receipts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id        UUID NOT NULL REFERENCES plants(id),
  receipt_date    DATE NOT NULL,
  rake_lot_no     VARCHAR(100),
  source_colliery VARCHAR(200),
  invoice_qty_mt  DECIMAL(12,3),
  actual_qty_mt   DECIMAL(12,3),   -- Weighbridge
  invoice_gcv     DECIMAL(10,2),
  actual_gcv      DECIMAL(10,2),
  invoice_rate    DECIMAL(12,2),
  entered_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
--  SUBMISSION STATUS (per module per day)
-- ─────────────────────────────────────────────────
CREATE TABLE submission_status (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id     UUID NOT NULL REFERENCES plants(id),
  entry_date   DATE NOT NULL,
  module       VARCHAR(50) NOT NULL CHECK (module IN ('power','fuel','performance','water','availability','scheduling','operations')),
  status       VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started','draft','submitted','approved')),
  submitted_by UUID REFERENCES users(id),
  approved_by  UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  approved_at  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date, module)
);

-- ─────────────────────────────────────────────────
--  AUDIT LOG
-- ─────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id    UUID REFERENCES plants(id),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,   -- CREATE, UPDATE, DELETE, APPROVE, LOGIN, etc.
  table_name  VARCHAR(100),
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────────────
CREATE INDEX idx_daily_power_plant_date        ON daily_power(plant_id, entry_date DESC);
CREATE INDEX idx_daily_fuel_plant_date         ON daily_fuel(plant_id, entry_date DESC);
CREATE INDEX idx_daily_performance_plant_date  ON daily_performance(plant_id, entry_date DESC);
CREATE INDEX idx_daily_water_plant_date        ON daily_water(plant_id, entry_date DESC);
CREATE INDEX idx_daily_availability_plant_date ON daily_availability(plant_id, entry_date DESC);
CREATE INDEX idx_daily_scheduling_plant_date   ON daily_scheduling(plant_id, entry_date DESC);
CREATE INDEX idx_operations_log_plant_date     ON operations_log(plant_id, entry_date DESC);
CREATE INDEX idx_submission_status_plant_date  ON submission_status(plant_id, entry_date DESC);
CREATE INDEX idx_audit_log_plant_created       ON audit_log(plant_id, created_at DESC);
CREATE INDEX idx_audit_log_user                ON audit_log(user_id);
CREATE INDEX idx_trip_events_plant             ON trip_events(plant_id, trip_datetime DESC);
CREATE INDEX idx_coal_receipts_plant_date      ON coal_receipts(plant_id, receipt_date DESC);

-- ─────────────────────────────────────────────────
--  SEED — Default IT Admin User
--  Password: Admin@1234 (change immediately)
-- ─────────────────────────────────────────────────
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@sepcpower.com',
  crypt('Admin@1234', gen_salt('bf', 12)),
  'IT Administrator',
  'it_admin'
);

-- ─────────────────────────────────────────────────
--  SEED — SEPC TTPP Plant
-- ─────────────────────────────────────────────────
INSERT INTO plants (name, short_name, location, company_name, document_number, capacity_mw, plf_base_mw)
VALUES (
  'SEPC Power Private Limited — TTPP Stage I',
  'TTPP',
  'Tuticorin, Tamil Nadu',
  'SEPC Power Private Limited',
  'SEPC/OPN/S/R – R 00',
  525.0,
  492.1875
);

-- Seed meter points for TTPP
INSERT INTO meter_points (plant_id, meter_code, meter_name, multiplier, meter_type, uom, sort_order)
SELECT p.id, v.code, v.meter_name, v.mult, v.mtype, 'MU', v.ord
FROM plants p,
(VALUES
  ('GEN_MAIN',    'GEN Meter - Main',       0.72,  'generation', 1),
  ('GEN_CHECK',   'GEN Meter - Check',      0.72,  'generation', 2),
  ('GT_IMP_MAIN', 'GT Main Import',         3.6,   'import',     3),
  ('GT_EXP_MAIN', 'GT Main Export',         3.6,   'export',     4),
  ('GT_IMP_CHK',  'GT Check Import',        3.6,   'import',     5),
  ('GT_EXP_CHK',  'GT Check Export',        3.6,   'export',     6),
  ('UT_A_IMP',    'UT A Main Import',       0.4,   'import',     7),
  ('UT_A_CHK',    'UT A Check Import',      0.4,   'import',     8),
  ('UT_B_IMP',    'UT B Main Import',       0.4,   'import',     9),
  ('UT_B_CHK',    'UT B Check Import',      0.4,   'import',     10),
  ('BR_IMP',      'BR Main Import',         1.8,   'import',     11),
  ('LINE1_EXP',   'Line 1 Main Export',     3.6,   'export',     12),
  ('LINE2_EXP',   'Line 2 Main Export',     3.6,   'export',     13)
) AS v(code, meter_name, mult, mtype, ord)
WHERE p.short_name = 'TTPP';

-- Seed active fuels for TTPP
INSERT INTO plant_fuels (plant_id, fuel_type, is_active)
SELECT p.id, fuel, TRUE
FROM plants p, (VALUES ('coal'),('ldo'),('hfo')) AS f(fuel)
WHERE p.short_name = 'TTPP';
