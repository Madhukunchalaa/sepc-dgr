const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        const res = await pool.query(`
            SELECT table_name
            FROM information_schema.columns
            WHERE column_name = 'plant_id' AND table_schema = 'public'
        `);
        console.log(res.rows.map(r => r.table_name).join('\n'));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
