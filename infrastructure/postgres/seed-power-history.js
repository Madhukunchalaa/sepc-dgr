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
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}

async function run() {
    console.log('Connecting to DB and loading Excel for Power seeding with dynamic column searches...');
    try {
        const { rows: plants } = await pool.query("SELECT id, capacity_mw, plf_base_mw FROM plants WHERE short_name = 'TTPP'");
        const plant = plants[0];
        const plantId = plant.id;

        const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
        const wsPower = wb.Sheets['Power'];
        const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

        // Build a dynamic header map from Row 2 and Row 3 where the labels exist
        const rowLabels = dataPower[2]; // Index 2 in array = excel row 3
        const rowLabels2 = dataPower[3]; // Index 3 in array = excel row 4

        // Find indices dynamically by searching string text across the headers
        let genCol = -1, exportCol = -1, importCol = -1, apcCol = -1, apcPctCol = -1, plfCol = -1, avgLoadCol = -1;

        // Excel places these labels far to the right, mostly in row 2 (index 2)
        for (let i = 0; i < rowLabels.length; i++) {
            if (i > 100) break; // DO NOT check beyond col 100 since daily fields repeat later for YTD
            const lab = String(rowLabels[i] || '').trim();
            if (lab === 'Power Generation' && genCol === -1) genCol = i;
            if (lab === 'Net Export' && exportCol === -1) exportCol = i;
            if (lab === 'GT Import' && importCol === -1) importCol = i;
            if (lab === 'APC' && apcCol === -1) apcCol = i;
            if (lab === 'APC %' && apcPctCol === -1) apcPctCol = i;
            if (lab === 'Plant Load Factor (PLF)' && plfCol === -1) plfCol = i;
            if (lab === 'Avg Power Generation' && avgLoadCol === -1) avgLoadCol = i;
        }

        console.log(`Dynamic Columns: Gen=${genCol}, Exp=${exportCol}, Imp=${importCol}, APC=${apcCol}, APCPct=${apcPctCol}, PLF=${plfCol}`);

        // If any failed, fallback to defaults
        if (genCol === -1) genCol = 63;
        if (exportCol === -1) exportCol = 82;
        if (importCol === -1) importCol = 79;
        if (apcCol === -1) apcCol = 85;
        if (apcPctCol === -1) apcPctCol = 88;
        if (plfCol === -1) plfCol = 70;
        if (avgLoadCol === -1) avgLoadCol = 67;

        let processed = 0, inserted = 0;

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
            } else {
                continue;
            }

            if (new Date(dateStr) > new Date('2026-02-05')) break;

            const meterReadings = {
                "GEN_MAIN": parseNum(row[1]),
                "GEN_CHECK": parseNum(row[2]),
                "UT_A_IMP": parseNum(row[7]),
                "UT_A_CHK": parseNum(row[8]),
                "UT_B_IMP": parseNum(row[9]),
                "UT_B_CHK": parseNum(row[10]),
                "BR_IMP": parseNum(row[11]),
                "BR_CHK": parseNum(row[12]),
                "LINE1_EXP": parseNum(row[28]),
                "LINE1_CHK_EXP": parseNum(row[29]),
                "LINE2_EXP": parseNum(row[30]),
                "GT_EXP_MAIN": parseNum(row[31]),
                "GT_EXP_CHK": parseNum(row[32]),
                "GT_IMP_MAIN": parseNum(row[34]),
                "GT_IMP_CHK": parseNum(row[35])
            };

            // Read explicit Computed MUs from Excel using dynamic cols!
            const generationMU = Math.min(parseNum(row[genCol]), 999999);
            const exportMU = Math.min(parseNum(row[exportCol]), 999999);
            const importMU = Math.min(parseNum(row[importCol]), 999999);
            const apcMU = Math.min(parseNum(row[apcCol]), 999999);
            const apcPctOrig = parseNum(row[apcPctCol]);
            const apcPct = Math.min(Math.max(apcPctOrig, -99), 99);

            let avgLoadMW = parseNum(row[avgLoadCol]);
            if (avgLoadMW === 0 && generationMU > 0) {
                avgLoadMW = (generationMU * 1000) / 24;
            }
            avgLoadMW = Math.min(avgLoadMW, 999999);

            let plfDaily = parseNum(row[plfCol]);
            if (plfDaily === 0 && avgLoadMW > 0 && plant.capacity_mw > 0) {
                plfDaily = avgLoadMW / plant.capacity_mw;
            }
            plfDaily = Math.min(Math.max(plfDaily, -99), 99);

            const q = `
                INSERT INTO daily_power (
                    plant_id, entry_date, meter_readings, status,
                    generation_mu, export_mu, import_mu, apc_mu, apc_pct, avg_load_mw, plf_daily
                ) VALUES ($1, $2, $3, 'approved', $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                    meter_readings = EXCLUDED.meter_readings,
                    status = 'approved',
                    generation_mu = EXCLUDED.generation_mu,
                    export_mu = EXCLUDED.export_mu,
                    import_mu = EXCLUDED.import_mu,
                    apc_mu = EXCLUDED.apc_mu,
                    apc_pct = EXCLUDED.apc_pct,
                    avg_load_mw = EXCLUDED.avg_load_mw,
                    plf_daily = EXCLUDED.plf_daily,
                    updated_at = NOW();
            `;

            try {
                await pool.query(q, [
                    plantId, dateStr, meterReadings,
                    generationMU, exportMU, importMU, apcMU, apcPct, avgLoadMW, plfDaily
                ]);
            } catch (err) {
                console.log(`Error updating ${dateStr}:`, { generationMU, exportMU, importMU, apcMU, apcPct, avgLoadMW, plfDaily });
                throw err;
            }

            processed++;
            inserted++;
        }

        console.log(`✅ Dynamic Power seeding complete! Processed ${processed}, inserted/updated ${inserted}.`);
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

run();
