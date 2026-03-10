const { Pool } = require('pg');
const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');
const fs = require('fs');

const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

const plant = { id: '36cd41f9-b150-46da-a778-a838679a343f', short_name: 'TAQA' };
const dates = ['2026-02-03', '2025-04-01', '2025-08-15'];

async function runAudit() {
    const results = {};
    for (const date of dates) {
        console.log(`Computing DGR for ${date}...`);
        try {
            const report = await assembleTaqaDGR(plant, date);
            results[date] = report;
        } catch (e) {
            console.error(`Failed for ${date}:`, e.message);
        }
    }

    fs.writeFileSync('audit_app_results.json', JSON.stringify(results, null, 2));
    console.log('Saved app results to audit_app_results.json');
    await pool.end();
}

runAudit();
