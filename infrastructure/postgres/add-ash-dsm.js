const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@postgres-ess5.railway.internal:5432/railway',
    ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS daily_ash (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id            UUID NOT NULL REFERENCES plants(id),
  entry_date          DATE NOT NULL,
  fa_to_user_mt       DECIMAL(12,3),
  fa_to_dyke_mt       DECIMAL(12,3),
  ba_to_user_mt       DECIMAL(12,3),
  ba_to_dyke_mt       DECIMAL(12,3),
  fa_generated_mt     DECIMAL(12,3),
  ba_generated_mt     DECIMAL(12,3),
  fa_silo_mt          DECIMAL(12,3),
  ba_silo_mt          DECIMAL(12,3),
  submitted_by        UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'draft',
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

CREATE TABLE IF NOT EXISTS daily_dsm (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id              UUID NOT NULL REFERENCES plants(id),
  entry_date            DATE NOT NULL,
  dsm_net_profit_lacs   DECIMAL(14,2),
  dsm_payable_lacs      DECIMAL(14,2),
  dsm_receivable_lacs   DECIMAL(14,2),
  dsm_coal_saving_lacs  DECIMAL(14,2),
  submitted_by          UUID REFERENCES users(id),
  status                VARCHAR(20) DEFAULT 'draft',
  submitted_at          TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_ash_plant_date ON daily_ash(plant_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_dsm_plant_date ON daily_dsm(plant_id, entry_date DESC);
`;

client.connect().then(async () => {
    try {
        console.log('Running missing table migrations...');
        await client.query(sql);
        console.log('Successfully created daily_ash and daily_dsm tables.');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        client.end();
    }
});
