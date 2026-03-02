const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const { assembleDGR } = require('./services/dgr-compute/src/engines/dgr.engine');

// We need to pass the password safely and override process.env just in case assembleDGR connects to db internally
process.env.DB_PASSWORD = '1234';

const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    try {
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = plants[0].id;
        const date = '2025-08-04';

        console.log(`\n\x1b[36m--- FETCHING FROM TEST ENGINE (${date}) ---\x1b[0m`);
        const dgr = await assembleDGR(plantId, date);

        console.log('Engine Generation MU:', dgr.power.generation.daily);
        console.log('Engine HFO Cons KL:', dgr.consumptionStock.hfoConsumption.daily);
        console.log('Engine Coal GCV AF:', dgr.performance.gcv.daily);
        console.log('');
        console.log('\x1b[32mEngine Computed SOC (ml/kWh):\x1b[0m', dgr.performance.soc.daily);
        console.log('\x1b[32mEngine Computed GHR (kCal/kWh):\x1b[0m', dgr.performance.ghr.daily);

        console.log(`\n\x1b[36m--- FETCHING FROM EXCEL (${date}) ---\x1b[0m`);
        const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');

        const ws = wb.Sheets['Detailed DGR'];
        if (ws) {
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            let row = data.find(r => r[55] && Math.abs((r[55]) - 25.534) < 0.1);

            if (row) {
                console.log('Found row matching Aug 4 stats!');
                console.log('Excel Generation MU:', row[3]);
                console.log('Excel HFO Cons KL (col 55):', row[55]);
                console.log('Excel Coal GCV AF (col 140):', row[140] || 'N/A');
                console.log('');
                console.log('\x1b[33mExcel SOC (ml/kWh):\x1b[0m', row[41]); // Mapped to AP
                console.log('\x1b[33mExcel GHR (kCal/kWh):\x1b[0m', row[46]); // Mapped to AU
            } else {
                console.log('Could not find historical row in Detailed DGR.');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
