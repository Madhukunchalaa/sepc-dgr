require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

function parseNum(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? null : num;
}

async function run() {
    console.log('Backfilling missing metrics from DGR Sheet for Sec 7, 8, 9, 10...');
    try {
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = plants[0].id;

        const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
        const wsPower = wb.Sheets['Power'];
        const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

        // DGR Engine takes:
        // DSM: dsm_net_profit_lacs, dsm_payable_lacs, dsm_receivable_lacs, dsm_coal_saving_lacs
        // URS: urs_net_profit_lacs
        // DC LOSS: loss_coal_mu, loss_coal_pct, loss_cre_smps_mu, loss_cre_smps_pct, loss_bunker_mu, loss_bunker_pct, loss_aoh_mu, loss_aoh_pct, loss_vacuum_mu, loss_vacuum_pct
        // OPS LOG: boiler_activities, turbine_activities, electrical_activities, bop_activities, remarks, observations

        // Find Dynamic Columns in Row 2 & 3
        const r2 = dataPower[2];
        const r3 = dataPower[3];

        let dsmNetCol = -1, dsmPayCol = -1, dsmRecCol = -1, dsmCoalCol = -1;
        let ursNetCol = -1;
        let lossCoalMuCol = -1, lossCoalPctCol = -1, lossCreMuCol = -1, lossCrePctCol = -1, lossBunkMuCol = -1, lossBunkPctCol = -1, lossAohMuCol = -1, lossAohPctCol = -1, lossVacMuCol = -1, lossVacPctCol = -1;

        // Scan columns
        for (let c = 0; c < 200; c++) {
            const l2 = String(r2[c] || '').trim().toLowerCase();
            const l3 = String(r3[c] || '').trim().toLowerCase();

            // DSM
            if (l2.includes('dsm net profit') || l3.includes('dsm net profit')) dsmNetCol = c;
            if (l2.includes('dsm payable') || l3.includes('dsm payable')) dsmPayCol = c;
            if (l2.includes('dsm receivable') || l3.includes('dsm receivable')) dsmRecCol = c;
            if (l2.includes('dsm coal') || l3.includes('dsm coal')) dsmCoalCol = c;

            // URS
            if (l2.includes('urs net profit') || l3.includes('urs net profit')) ursNetCol = c;

            // DC Loss - usually has nested columns
            if (l2.includes('coal shortage') || l3.includes('coal shortage')) {
                if (String(r3[c]).includes('MU')) lossCoalMuCol = c;
                if (String(r3[c + 1] || '').includes('%')) lossCoalPctCol = c + 1;
            }
            if (l2.includes('cre') || l3.includes('cre')) {
                if (String(r3[c]).includes('MU') || lossCreMuCol === -1) lossCreMuCol = c;
                if (String(r3[c + 1] || '').includes('%')) lossCrePctCol = c + 1;
            }
            if (l2.includes('bunker') || l3.includes('bunker')) {
                if (String(r3[c]).includes('MU') || lossBunkMuCol === -1) lossBunkMuCol = c;
                if (String(r3[c + 1] || '').includes('%')) lossBunkPctCol = c + 1;
            }
            if (l2.includes('aoh') || l3.includes('aoh')) {
                if (String(r3[c]).includes('MU') || lossAohMuCol === -1) lossAohMuCol = c;
                if (String(r3[c + 1] || '').includes('%')) lossAohPctCol = c + 1;
            }
            if (l2.includes('vac') || l3.includes('vac')) {
                if (String(r3[c]).includes('MU') || lossVacMuCol === -1) lossVacMuCol = c;
                if (String(r3[c + 1] || '').includes('%')) lossVacPctCol = c + 1;
            }
        }

        console.log({ dsmNetCol, dsmPayCol, dsmRecCol, dsmCoalCol, ursNetCol, lossCoalMuCol, lossCoalPctCol, lossCreMuCol, lossCrePctCol, lossBunkMuCol, lossBunkPctCol, lossAohMuCol, lossAohPctCol, lossVacMuCol, lossVacPctCol });

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}
run();
