require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: Number(process.env.DB_PORT || 5432),
  });

  const plantId = '36cd41f9-b150-46da-a778-a838679a343f';
  const date = process.argv[2] || '2025-07-10';

  const { rows } = await pool.query(
    `SELECT * FROM daily_water WHERE plant_id = $1 AND entry_date = $2`,
    [plantId, date]
  );
  console.log(date, rows);
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

