const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    const res = await pool.query(`
        SELECT pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conname = 'submission_status_module_check'
    `);
    console.log(res.rows[0].pg_get_constraintdef);
}
run().finally(() => pool.end());
