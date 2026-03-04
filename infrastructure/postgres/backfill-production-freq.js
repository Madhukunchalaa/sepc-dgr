// infrastructure/postgres/backfill-production-freq.js
// Run this on production to sync 311 days of Excel frequency data to the DB
require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}

async function run() {
    console.log('Starting Production Frequency Backfill...');
    try {
        const filePath = path.join(__dirname, '../../DGR FY 2025-20261 - V1 (1).xlsx');
        const wb = XLSX.readFile(filePath);
        const wsPower = wb.Sheets['Power'];
        const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

        let count = 0;
        for (let r = 5; r < dataPower.length; r++) {
            const row = dataPower[r];
            if (!row || !row[0]) continue;

            const dateVal = row[0];
            let dateStr;
            if (typeof dateVal === 'number') {
                const parsed = XLSX.SSF.parse_date_code(dateVal);
                dateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
            } else if (typeof dateVal === 'string' && dateVal.includes('-')) {
                dateStr = new Date(dateVal).toISOString().split('T')[0];
            } else continue;

            if (new Date(dateStr) > new Date('2026-02-05')) break;

            const freqMin = parseNum(row[148]);
            const freqMax = parseNum(row[149]);
            const freqAvg = parseNum(row[150]);

            if (freqMin || freqMax || freqAvg) {
                await pool.query(
                    `UPDATE daily_power SET freq_min=$1, freq_max=$2, freq_avg=$3 WHERE entry_date=$4`,
                    [freqMin, freqMax, freqAvg, dateStr]
                );
                count++;
            }
        }
        console.log(`✅ Successfully backfilled ${count} records on production.`);
    } catch (e) {
        console.error("Backfill failed:", e);
    } finally {
        await pool.end();
    }
}

run();
