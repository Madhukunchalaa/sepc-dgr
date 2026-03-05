const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function check() {
    const { rows } = await pool.query(`
        SELECT COUNT(*) as count, MIN(entry_date) as min_date, MAX(entry_date) as max_date, SUM(export_mu - import_mu) as net_export 
        FROM daily_power 
        WHERE entry_date >= '2025-04-01' AND entry_date <= '2025-06-12'
        AND status IN ('submitted','approved','locked')
    `);
    console.log("App YTD Net Export till June 12:", rows[0]);
    pool.end();
}
check();
