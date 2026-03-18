process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

async function main() {
  const res = await pool.query(
    `SELECT entry_date, deemed_gen_mwhr, declared_capacity_mwhr, schedule_gen_mldc,
            net_export, no_unit_trips, no_unit_shutdown, dispatch_duration,
            load_backdown_duration, unit_standby_hrs, scheduled_outage_hrs, forced_outage_hrs
     FROM taqa_daily_input
     WHERE plant_id = $1 AND entry_date = '2026-01-18'`,
    [PID]
  );
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
