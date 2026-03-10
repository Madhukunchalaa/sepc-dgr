const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function diagnose() {
    const plantId = '78920445-14de-4144-b736-8dc7a5849ca1';
    const date = '2026-03-02';
    const dateToday = '2026-03-08';

    try {
        console.log('--- Database Diagnosis ---');

        // Check tables existence
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('plants', 'taqa_daily_input', 'submission_status', 'daily_power')");
        console.log('Existing Tables:', tables.rows.map(r => r.table_name));

        // Check TAQA plant
        const plant = await pool.query("SELECT * FROM plants WHERE id=$1", [plantId]);
        console.log('Plant Info:', plant.rows[0]?.short_name || 'NOT FOUND');

        // Check Raw Input
        const raw = await pool.query("SELECT entry_date, status, updated_at FROM taqa_daily_input WHERE plant_id=$1 ORDER BY entry_date DESC LIMIT 5", [plantId]);
        console.log('Recent Raw Inputs:', raw.rows);

        // Check specific date raw input
        const specificRaw = await pool.query("SELECT COUNT(*) FROM taqa_daily_input WHERE plant_id=$1 AND entry_date=$2", [plantId, date]);
        console.log(`Raw items for ${date}:`, specificRaw.rows[0].count);

        const specificRawToday = await pool.query("SELECT COUNT(*) FROM taqa_daily_input WHERE plant_id=$1 AND entry_date=$2", [plantId, dateToday]);
        console.log(`Raw items for ${dateToday}:`, specificRawToday.rows[0].count);

        // Check submission status
        const sub = await pool.query("SELECT * FROM submission_status WHERE plant_id=$1 AND entry_date=$2", [plantId, date]);
        console.log(`Submission Status for ${date}:`, sub.rows);

        const subToday = await pool.query("SELECT * FROM submission_status WHERE plant_id=$1 AND entry_date=$2", [plantId, dateToday]);
        console.log(`Submission Status for ${dateToday}:`, subToday.rows);

        // Check daily power
        const pwr = await pool.query("SELECT * FROM daily_power WHERE plant_id=$1 AND entry_date=$2", [plantId, date]);
        console.log(`Daily Power for ${date}:`, pwr.rows);

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
diagnose();
