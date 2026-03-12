const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

const TTPP_ID = '78920445-14de-4144-b736-8dc7a5849ca1';
const TAQA_ID = '36cd41f9-b150-46da-a778-a838679a343f';

async function fix() {
    console.log('--- DEFINITIVE FIX ---');

    // 1. Move everything to temp names to avoid unique constraint if it exists
    await pool.query("UPDATE plants SET short_name = 'TEMP_TTPP' WHERE id = $1", [TTPP_ID]);
    await pool.query("UPDATE plants SET short_name = 'TEMP_TAQA' WHERE id = $1", [TAQA_ID]);

    // 2. Set the correct final names
    await pool.query("UPDATE plants SET short_name = 'TTPP' WHERE id = $1", [TTPP_ID]);
    await pool.query("UPDATE plants SET short_name = 'TAQA' WHERE id = $1", [TAQA_ID]);

    // 3. Verify
    const { rows } = await pool.query('SELECT id, name, short_name, capacity_mw FROM plants');
    console.log('Post-Fix Verification:');
    rows.forEach(r => {
        console.log(`[${r.short_name}] ID=${r.id} Name=${r.name} Cap=${r.capacity_mw}`);
    });
}

fix()
    .then(() => console.log('✅ Fix complete'))
    .catch(e => console.error('❌ Fix failed:', e))
    .finally(() => pool.end());
