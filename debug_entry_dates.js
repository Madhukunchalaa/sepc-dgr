const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    console.log('--- Table: taqa_daily_input (Partial schema) ---');
    const taqaCols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'taqa_daily_input' 
          AND column_name IN ('entry_date', 'plant_id')
    `);
    console.log(taqaCols.rows);

    console.log('\n--- Table: daily_power (Partial schema) ---');
    const powerCols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'daily_power' 
          AND column_name IN ('entry_date', 'plant_id')
    `);
    console.log(powerCols.rows);

    console.log('\n--- TAQA Entries (Latest 5) ---');
    const taqaEntries = await pool.query(`
        SELECT plant_id, entry_date, created_at
        FROM taqa_daily_input
        ORDER BY entry_date DESC
        LIMIT 5
    `);
    console.log(taqaEntries.rows.map(r => ({
        ...r,
        entry_date_iso: r.entry_date.toISOString(),
        entry_date_string: String(r.entry_date)
    })));

    console.log('\n--- TTPP Power Entries (Latest 5) ---');
    const powerEntries = await pool.query(`
        SELECT plant_id, entry_date, status
        FROM daily_power
        WHERE plant_id = '36cd41f9-b150-46da-a778-a838679a343f'
        ORDER BY entry_date DESC
        LIMIT 5
    `);
    console.log(powerEntries.rows.map(r => ({
        ...r,
        entry_date_iso: r.entry_date ? r.entry_date.toISOString() : null,
        entry_date_string: String(r.entry_date)
    })));
}

run().catch(console.error).finally(() => pool.end());
