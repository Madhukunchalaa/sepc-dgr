require('dotenv').config();
const { Pool } = require('pg');

process.env.DB_PASSWORD = '1234';
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    try {
        const { rows } = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('daily_performance','daily_water','daily_availability','daily_scheduling','operations_log') 
      ORDER BY table_name, ordinal_position;
    `);
        const m = {};
        rows.forEach(r => {
            m[r.table_name] = m[r.table_name] || [];
            m[r.table_name].push(r.column_name);
        });
        console.log(JSON.stringify(m, null, 2));
    } catch (e) { console.error(e); } finally { pool.end(); }
}

run();
