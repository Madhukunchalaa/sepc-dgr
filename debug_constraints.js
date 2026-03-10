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
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint 
        WHERE conrelid = 'submission_status'::regclass 
          AND contype = 'c'
    `);
    res.rows.forEach(r => {
        console.log(`--- ${r.conname} ---`);
        console.log(r.def);
    });
}

run().catch(console.error).finally(() => pool.end());
