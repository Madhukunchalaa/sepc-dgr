// verify_taqa_table.js — run: node verify_taqa_table.js
const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function verify() {
    try {
        const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='taqa_daily_input'");
        console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));

        console.log('Table is READY for TAQA data entry!');
    } catch (e) {
        console.error('ERROR:', e.message);
        if (e.message.includes('does not exist')) {
            console.log('Table does not exist yet. Please run the migration SQL in pgAdmin.');
        }
    } finally {
        await pool.end();
    }
}

verify();
