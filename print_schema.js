const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432,
});

async function run() {
    const { rows } = await pool.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('daily_power', 'daily_fuel', 'daily_water', 'daily_availability', 'daily_scheduling', 'daily_performance', 'daily_ash', 'daily_dsm', 'daily_urs', 'daily_dc_loss') ORDER BY table_name, ordinal_position"
    );
    const schema = {};
    rows.forEach(r => {
        schema[r.table_name] = schema[r.table_name] || [];
        schema[r.table_name].push(r.column_name);
    });
    console.log(JSON.stringify(schema, null, 2));
    await pool.end();
}
run().catch(console.error);
