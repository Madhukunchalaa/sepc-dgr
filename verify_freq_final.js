require('dotenv').config();
const { Pool } = require('pg');

async function check() {
    const pool = new Pool({
        user: process.env.DB_USER || 'dgr_user',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'dgr_platform',
        password: process.env.DB_PASSWORD || '1234',
        port: Number(process.env.DB_PORT || 5432),
    });

    try {
        const res = await pool.query("SELECT entry_date, freq_min, freq_max, freq_avg FROM daily_power WHERE entry_date = '2025-05-15'");
        console.log('Verification for 2025-05-15:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
