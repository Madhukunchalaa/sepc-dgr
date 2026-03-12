const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function fix() {
    console.log('--- START PLANT FIX ---');

    // 1. Correct the short names
    // TTPP (525 MW) -> TTPP
    await pool.query("UPDATE plants SET short_name = 'TTPP' WHERE id = '78920445-14de-4144-b736-8dc7a5849ca1'");
    // TAQA (250 MW) -> TAQA
    await pool.query("UPDATE plants SET short_name = 'TAQA' WHERE id = '36cd41f9-b150-46da-a778-a838679a343f'");

    console.log('✅ Short names updated.');

    // 2. Audit result
    const res = await pool.query('SELECT id, short_name, name, capacity_mw FROM plants');
    console.log('\n--- FINAL PLANT LIST ---');
    res.rows.forEach(p => {
        console.log(`ID: ${p.id} | Short: ${p.short_name} | Capacity: ${p.capacity_mw} | Name: ${p.name}`);
    });
    console.log('------------------------');
}

fix().catch(console.error).finally(() => pool.end());
