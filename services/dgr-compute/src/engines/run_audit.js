const { assembleTaqaDGR } = require('./taqa.engine');
const fs = require('fs');

const plant = { id: '36cd41f9-b150-46da-a778-a838679a343f', short_name: 'TAQA' };
const dates = ['2026-02-03', '2025-04-01', '2025-08-15'];

async function runAudit() {
    process.env.DB_USER = 'dgr_user';
    process.env.DB_PASSWORD = '1234';
    process.env.DB_NAME = 'dgr_platform';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';

    const results = {};
    for (const date of dates) {
        console.log(`Computing DGR for ${date}...`);
        try {
            const report = await assembleTaqaDGR(plant, date);
            results[date] = report;
        } catch (e) {
            console.error(`Failed for ${date}:`, e.stack);
        }
    }

    fs.writeFileSync('audit_app_results.json', JSON.stringify(results, null, 2));
    console.log('Saved app results to audit_app_results.json');
    process.exit(0);
}

runAudit();
