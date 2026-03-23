// Migration: Add extended columns to anpara_daily_input
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway'
});

const SQL = `
ALTER TABLE anpara_daily_input
  ADD COLUMN IF NOT EXISTS u1_total_dc_loss_mu  NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_total_outage_mu    NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_high_freq_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_ramp_down_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_ramp_up_mu         NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_ash_handling_mu    NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_equip_partial_mu   NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_high_coal_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_unit_stab_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_rgmo_mu            NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_iex_mu             NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_apc_margin_mu      NUMERIC,
  ADD COLUMN IF NOT EXISTS u1_no_trips           NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_total_dc_loss_mu   NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_total_outage_mu    NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_high_freq_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_ramp_down_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_ramp_up_mu         NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_ash_handling_mu    NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_equip_partial_mu   NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_high_coal_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_unit_stab_mu       NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_rgmo_mu            NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_iex_mu             NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_apc_margin_mu      NUMERIC,
  ADD COLUMN IF NOT EXISTS u2_no_trips           NUMERIC;
`;

async function run() {
    console.log('Running migration: add extended Anpara columns...');
    await pool.query(SQL);
    console.log('Migration complete.');
    await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
