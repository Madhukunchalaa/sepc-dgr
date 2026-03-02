require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const { assembleDGR } = require('./services/dgr-compute/src/engines/dgr.engine');

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
        const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');
        const dgrSheet = wb.Sheets['DGR'];
        const dgrData = XLSX.utils.sheet_to_json(dgrSheet, { header: 1 });

        // Find active date
        const dateCellStr = String(dgrData[4][14] || '').trim(); // "05-Feb-2026"

        console.log(`\n\x1b[36m--- ACTIVE EXCEL DGR SHEET METRICS (${dateCellStr}) ---\x1b[0m`);

        // Scrape specific calculation cells directly
        const excelGenMU = Number((dgrData[18]?.[5] || 0)); // Row 19, Col F
        const excelSCC = Number((dgrData[22]?.[7] || 0));   // Row 23, Col H
        const excelSOC = Number((dgrData[23]?.[7] || 0));   // Row 24, Col H
        const excelGHR = Number((dgrData[24]?.[7] || 0));   // Row 25, Col H

        console.log('EXCEL Generation MU:', excelGenMU.toFixed(4));
        console.log('\x1b[33mEXCEL SCC (kg/kWh):\x1b[0m', excelSCC.toFixed(4));
        console.log('\x1b[33mEXCEL SOC (ml/kWh):\x1b[0m', excelSOC.toFixed(4));
        console.log('\x1b[33mEXCEL GHR (kCal/kWh):\x1b[0m', excelGHR.toFixed(2));


        console.log(`\n\x1b[36m--- COMPUTING SCADA ENGINE (${dateCellStr}) ---\x1b[0m`);
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = plants[0].id;

        // Convert 05-Feb-2026 to YYYY-MM-DD
        const activeDate = new Date('2026-02-05').toISOString().split('T')[0];
        const dgrLive = await assembleDGR(plantId, activeDate);

        console.log('ENGINE Generation MU:', dgrLive.power.generation.daily);
        console.log('\x1b[32mENGINE SCC (kg/kWh):\x1b[0m', typeof dgrLive.performance.scc.daily === 'number' ? dgrLive.performance.scc.daily.toFixed(4) : 0);
        console.log('\x1b[32mENGINE SOC (ml/kWh):\x1b[0m', typeof dgrLive.performance.soc.daily === 'number' ? dgrLive.performance.soc.daily.toFixed(4) : 0);
        console.log('\x1b[32mENGINE GHR (kCal/kWh):\x1b[0m', typeof dgrLive.performance.ghr.daily === 'number' ? dgrLive.performance.ghr.daily.toFixed(2) : 0);

        console.log(`\n--- DIFFERENCE ---\nSCC Diff: ${Math.abs(excelSCC - (dgrLive.performance.scc.daily || 0)).toFixed(4)}\nSOC Diff: ${Math.abs(excelSOC - (dgrLive.performance.soc.daily || 0)).toFixed(4)}\nGHR Diff: ${Math.abs(excelGHR - (dgrLive.performance.ghr.daily || 0)).toFixed(2)}`);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
