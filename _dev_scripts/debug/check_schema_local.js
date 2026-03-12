const { Pool } = require('./node_modules/pg');
const pool = new Pool({
    host: 'localhost',
    database: 'dgr_platform',
    user: 'dgr_user',
    password: '1234',
    port: 5432
});

async function run() {
    const res = await pool.query(
        "SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 'daily_power'"
    );
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
}

run();
