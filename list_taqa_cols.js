const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'taqa_daily_input' 
    ORDER BY ordinal_position
  `);
    res.rows.forEach(row => {
        console.log(`${row.column_name} (${row.data_type})`);
    });
}

run().finally(() => pool.end());
