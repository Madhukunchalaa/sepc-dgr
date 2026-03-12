const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    console.log('--- SWAPPING ---');
    // 1. Move to temp names
    await pool.query("UPDATE plants SET short_name = 'TEMP1' WHERE id = '78920445-14de-4144-b736-8dc7a5849ca1'");
    await pool.query("UPDATE plants SET short_name = 'TEMP2' WHERE id = '36cd41f9-b150-46da-a778-a838679a343f'");

    // 2. Set correct names
    // TTPP (525 MW) -> TTPP
    await pool.query("UPDATE plants SET short_name = 'TTPP' WHERE id = '78920445-14de-4144-b736-8dc7a5849ca1'");
    // TAQA (250 MW) -> TAQA
    await pool.query("UPDATE plants SET short_name = 'TAQA' WHERE id = '36cd41f9-b150-46da-a778-a838679a343f'");

    console.log('Fixed.');

    console.log('\n--- VERIFYING ---');
    const res = await pool.query('SELECT id, short_name, capacity_mw FROM plants');
    res.rows.forEach(p => console.log(`ID: ${p.id} | Short: ${p.short_name} | Cap: ${p.capacity_mw}`));
}

run().catch(console.error).finally(() => pool.end());
