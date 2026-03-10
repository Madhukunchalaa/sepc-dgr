const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    console.log('--- PRE-FIX AUDIT ---');
    const pre = await pool.query('SELECT id, short_name, name, capacity_mw FROM plants');
    pre.rows.forEach(p => console.log(`ID: ${p.id} | Short: ${p.short_name} | Cap: ${p.capacity_mw} | Name: ${p.name.substring(0, 30)}`));

    console.log('\n--- FIXING ---');
    // TTPP (525 MW) -> TTPP
    await pool.query("UPDATE plants SET short_name = 'TTPP' WHERE id = '78920445-14de-4144-b736-8dc7a5849ca1'");
    // TAQA (250 MW) -> TAQA
    await pool.query("UPDATE plants SET short_name = 'TAQA' WHERE id = '36cd41f9-b150-46da-a778-a838679a343f'");
    console.log('Fixed names.');

    console.log('\n--- POST-FIX AUDIT ---');
    const post = await pool.query('SELECT id, short_name, name, capacity_mw FROM plants');
    post.rows.forEach(p => console.log(`ID: ${p.id} | Short: ${p.short_name} | Cap: ${p.capacity_mw} | Name: ${p.name.substring(0, 30)}`));

    // also check if any other table uses plant_id and short_name together (unlikely but good to know)
    console.log('\n--- DATA LOCATION AUDIT ---');
    const taqaCount = await pool.query('SELECT plant_id, count(*) FROM taqa_daily_input GROUP BY plant_id');
    taqaCount.rows.forEach(r => console.log(`PlantID: ${r.plant_id} | Records in taqa_daily_input: ${r.count}`));
}

run().catch(console.error).finally(() => pool.end());
