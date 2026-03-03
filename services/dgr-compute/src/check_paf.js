const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function check() {
    const rs = await Promise.all([
        pool.query("SELECT plf_daily FROM daily_power WHERE plant_id='36cd41f9-b150-46da-a778-a838679a343f' LIMIT 1"),
        pool.query("SELECT paf_pct FROM daily_availability WHERE plant_id='36cd41f9-b150-46da-a778-a838679a343f' LIMIT 1")
    ]);
    console.log('PLF:', rs[0].rows[0]?.plf_daily);
    console.log('PAF:', rs[1].rows[0]?.paf_pct);
    await pool.end();
}
check();
