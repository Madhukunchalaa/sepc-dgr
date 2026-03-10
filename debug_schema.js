const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    console.log('--- Submission Status Detailed Schema ---');
    const ss = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'submission_status'
    `);
    ss.rows.forEach(r => {
        console.log(`Col: ${r.column_name} | Type: ${r.data_type} | Null: ${r.is_nullable} | Def: ${r.column_default}`);
    });
}

run().catch(console.error).finally(() => pool.end());
