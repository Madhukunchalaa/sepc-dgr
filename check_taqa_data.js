const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

const TAQA_ID = '36cd41f9-b150-46da-a778-a838679a343f';
const TTPP_ID = '78920445-14de-4144-b736-8dc7a5849ca1';

async function audit() {
    console.log('--- AUDIT REPORT ---');

    // 1. Check taqa_daily_input counts
    const taqaCount = await pool.query('SELECT count(*) FROM taqa_daily_input WHERE plant_id = $1', [TAQA_ID]);
    const ttppCount = await pool.query('SELECT count(*) FROM taqa_daily_input WHERE plant_id = $1', [TTPP_ID]);
    console.log(`taqa_daily_input records for TAQA (${TAQA_ID}): ${taqaCount.rows[0].count}`);
    console.log(`taqa_daily_input records for TTPP (${TTPP_ID}): ${ttppCount.rows[0].count}`);

    // 2. See the most recent records across all plants
    const recent = await pool.query('SELECT plant_id, entry_date, created_at FROM taqa_daily_input ORDER BY created_at DESC LIMIT 5');
    console.log('\nRecent records in taqa_daily_input:');
    recent.rows.forEach(r => console.log(`- Plant: ${r.plant_id}, Date: ${r.entry_date.toISOString().split('T')[0]}, Created: ${r.created_at}`));

    // 3. Check submission_status for any TAQA entries
    const subStatus = await pool.query('SELECT plant_id, entry_date, status FROM submission_status WHERE plant_id = $1 ORDER BY entry_date DESC LIMIT 5', [TAQA_ID]);
    console.log('\nRecent TAQA records in submission_status:');
    subStatus.rows.forEach(r => console.log(`- Date: ${r.entry_date.toISOString().split('T')[0]}, Status: ${r.status}`));

    // 4. Try to find the record from the screenshot (14-01-2026)
    const targetDate = '2026-01-14';
    const target = await pool.query('SELECT plant_id, entry_date, id FROM taqa_daily_input WHERE entry_date = $1', [targetDate]);
    console.log(`\nRecords for ${targetDate} (any plant):`, target.rows);
}

audit().catch(console.error).finally(() => pool.end());
