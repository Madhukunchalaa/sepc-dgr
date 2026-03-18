process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

async function main() {
  // Excel Jan-18 values:
  // SN3 Dispatch Demand = 1.3 MU  → deemed_gen_mwhr = 1300
  // SN4 Schedule Gen    = 4.3 MU  → schedule_gen_mldc = 4300
  // SN6 Deemed Gen      = 6.0 MU  → declared_capacity_mwhr = 6000
  const res = await pool.query(
    `UPDATE taqa_daily_input
     SET deemed_gen_mwhr = 1300,
         declared_capacity_mwhr = 6000,
         schedule_gen_mldc = 4300
     WHERE plant_id = $1 AND entry_date = '2026-01-18'
     RETURNING id, entry_date, deemed_gen_mwhr, declared_capacity_mwhr, schedule_gen_mldc`,
    [PID]
  );
  console.log('Patched:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
