const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function audit() {
    console.log('--- START AUDIT ---');

    const plants = await pool.query('SELECT id, short_name, name FROM plants');
    console.log('PLANTS TABLE:');
    plants.rows.forEach(p => {
        console.log(`- ID: [${p.id}] Short: [${p.short_name}] Name: [${p.name}]`);
    });

    const taqaCounts = await pool.query('SELECT plant_id, count(*) FROM taqa_daily_input GROUP BY plant_id');
    console.log('\nTAQA_DAILY_INPUT COUNTS:');
    taqaCounts.rows.forEach(r => {
        console.log(`- PlantID: [${r.plant_id}] Count: ${r.count}`);
    });

    const subCounts = await pool.query('SELECT plant_id, count(*) FROM submission_status GROUP BY plant_id');
    console.log('\nSUBMISSION_STATUS COUNTS:');
    subCounts.rows.forEach(r => {
        console.log(`- PlantID: [${r.plant_id}] Count: ${r.count}`);
    });

    console.log('--- END AUDIT ---');
}

audit().catch(console.error).finally(() => pool.end());
