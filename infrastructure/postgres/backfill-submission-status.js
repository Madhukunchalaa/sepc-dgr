require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'dgr_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dgr_platform',
  password: process.env.DB_PASSWORD || '1234',
  port: Number(process.env.DB_PORT || 5432),
});

async function backfillForTable(plantId, module, table, statusColumn = 'status') {
  const { rows } = await pool.query(
    `SELECT entry_date, ${statusColumn} AS status
     FROM ${table}
     WHERE plant_id = $1`,
    [plantId]
  );

  let count = 0;
  for (const r of rows) {
    let st = r.status || 'approved';
    if (st === 'locked') st = 'approved';
    if (!['not_started','draft','submitted','approved'].includes(st)) {
      st = 'approved';
    }

    await pool.query(
      `INSERT INTO submission_status (plant_id, entry_date, module, status, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (plant_id, entry_date, module)
       DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
      [plantId, r.entry_date, module, st]
    );
    count++;
  }
  return count;
}

async function run() {
  try {
    const { rows: plants } = await pool.query(
      `SELECT id FROM plants WHERE short_name='TTPP' OR short_name='TEST' LIMIT 1`
    );
    if (!plants.length) throw new Error('No plant found');
    const plantId = plants[0].id;

    console.log('Backfilling submission_status for plant', plantId);

    const results = {};
    results.power = await backfillForTable(plantId, 'power', 'daily_power');
    results.fuel = await backfillForTable(plantId, 'fuel', 'daily_fuel');
    results.performance = await backfillForTable(plantId, 'performance', 'daily_performance');
    results.water = await backfillForTable(plantId, 'water', 'daily_water');
    results.availability = await backfillForTable(plantId, 'availability', 'daily_availability');
    results.scheduling = await backfillForTable(plantId, 'scheduling', 'daily_scheduling');
    results.operations = await backfillForTable(plantId, 'operations', 'operations_log');

    console.log('Backfill counts per module:', results);
  } catch (e) {
    console.error('Backfill failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

