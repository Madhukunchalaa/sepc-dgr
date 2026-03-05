require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');

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

function parseDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal === 'number') {
        const parsed = XLSX.SSF.parse_date_code(dateVal);
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    if (typeof dateVal === 'string' && dateVal.includes('-')) {
        return new Date(dateVal).toISOString().split('T')[0];
    }
    return null;
}

async function run() {
    console.log('Backfilling DM and Filtered Water Generation...');
    try {
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = plants[0].id;

        const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
        const wsWater = wb.Sheets['Water'];
        const dataWater = XLSX.utils.sheet_to_json(wsWater, { header: 1, defval: null });

        let count = 0;
        for (let r = 5; r < dataWater.length; r++) {
            const rowWater = dataWater[r];
            if (!rowWater || !rowWater[0]) continue;

            const dateStr = parseDate(rowWater[0]);
            if (!dateStr) continue;
            if (new Date(dateStr) > new Date('2026-02-05')) break;

            const dmGen = parseNum(rowWater[1]);       // Col 1
            const filteredGen = parseNum(rowWater[17]); // Col 17

            if (dmGen !== null || filteredGen !== null) {
                await pool.query(`
                    UPDATE daily_water 
                    SET dm_generation_m3 = $1, filtered_water_gen_m3 = $2
                    WHERE plant_id = $3 AND entry_date = $4
                `, [dmGen, filteredGen, plantId, dateStr]);
                count++;
            }
        }
        console.log(`✅ Backfilled Generation Water Metrics: ${count} records`);
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await pool.end();
    }
}

run();
