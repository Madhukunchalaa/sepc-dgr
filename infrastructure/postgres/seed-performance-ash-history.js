// seed-performance-ash-history.js
const XLSX = require('xlsx');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: process.env.DB_PORT || 5432,
});

async function run() {
    const filePath = path.join(__dirname, '../../DGR FY 2025-20261 - V1 (1).xlsx');
    console.log(`Reading ${filePath}...`);
    const wb = XLSX.readFile(filePath);

    const faData = XLSX.utils.sheet_to_json(wb.Sheets['Fuel & Ash'], { header: 1, defval: null });
    const perfData = XLSX.utils.sheet_to_json(wb.Sheets['Perf'], { header: 1, defval: null });

    // Find Ash columns
    let faUser = -1, faDyke = -1, faGen = -1;
    let baUser = -1, baDyke = -1, baGen = -1;

    const faRow3 = faData[3];
    for (let i = 0; i < faRow3?.length; i++) {
        const str = String(faRow3[i] || '').trim();
        if (str === 'Fly Ash + APH + Duct + Chimney Generated' && faGen === -1) faGen = i;
        if (str === 'Bottom + Eco Ash Generated' && baGen === -1) baGen = i;
        if (str === 'Fly Ash Utilized' && faUser === -1) faUser = i;
        if (str === 'Fly Ash to Dyke' && faDyke === -1) faDyke = i;
        if (str === 'Bottom Ash Utilized' && baUser === -1) baUser = i;
        if (str === 'Bottom Ash to Dyke' && baDyke === -1) baDyke = i;
    }

    if (faGen === -1) faGen = 53;
    if (baGen === -1) baGen = 56;
    if (faUser === -1) faUser = 59;
    if (faDyke === -1) faDyke = 62;
    if (baUser === -1) baUser = 65;
    if (baDyke === -1) baDyke = 68;

    // Find Perf columns
    let gcvAr = -1, gcvAf = -1, ghrDir = -1, loiBa = -1, loiFa = -1, fc = -1, vm = -1, millA = -1, millB = -1, millC = -1;
    const perfRow4 = perfData[4]; // Row 5 is usually the sub-labels, or Row 4
    // Actually Perf doesn't have a reliable sub-row. Col 1=GCV AR, Col 5=GCV AF, Col 9=GHR Direct, 6=LOI BA, 7=LOI FA, 8=FC%, 9=VM%, 11=Mill meshes.
    // We'll use fixed indices based on observations:
    // Col 1 = GCV AR, Col 5 = GCV AF, Col 9 = GHR, Col 6 = LOI BA, Col 7 = LOI FA, Col 8 = FC, Col 9 = VM
    gcvAr = 1; gcvAf = 5; ghrDir = 9; loiBa = 6; loiFa = 7; fc = 8; vm = 9;

    const parseNum = (val) => {
        if (val === null || val === undefined || val === '') return null;
        const str = String(val).split('/')[0].trim();
        const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;
    };

    const { rows: plants } = await pool.query(`SELECT id FROM plants WHERE short_name = 'TTPP' LIMIT 1`);
    if (!plants.length) return;
    const plantId = plants[0].id;

    console.log(`Working on Plant ${plantId}...`);

    for (let r = 6; r < faData.length; r++) {
        const faRow = faData[r] || [];
        if (!faRow[0]) continue;

        const dateObj = XLSX.SSF.parse_date_code(faRow[0]);
        if (!dateObj) continue;
        const entryDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;

        // Ash
        const faG = parseNum(faRow[faGen]);
        const baG = parseNum(faRow[baGen]);
        const faU = parseNum(faRow[faUser]);
        const faD = parseNum(faRow[faDyke]);
        const baU = parseNum(faRow[baUser]);
        const baD = parseNum(faRow[baDyke]);

        await pool.query(`
            INSERT INTO daily_ash (
                plant_id, entry_date, 
                fa_generated_mt, ba_generated_mt, fa_to_user_mt, fa_to_dyke_mt, ba_to_user_mt, ba_to_dyke_mt, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved')
            ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                fa_generated_mt=EXCLUDED.fa_generated_mt,
                ba_generated_mt=EXCLUDED.ba_generated_mt,
                fa_to_user_mt=EXCLUDED.fa_to_user_mt,
                fa_to_dyke_mt=EXCLUDED.fa_to_dyke_mt,
                ba_to_user_mt=EXCLUDED.ba_to_user_mt,
                ba_to_dyke_mt=EXCLUDED.ba_to_dyke_mt,
                status='approved'
        `, [plantId, entryDate, faG, baG, faU, faD, baU, baD]);

        // Perf
        let perfRow = [];
        for (let pr = 6; pr < perfData.length; pr++) {
            if (perfData[pr] && perfData[pr][0] === faRow[0]) {
                perfRow = perfData[pr];
                break;
            }
        }

        const pGcvAr = parseNum(perfRow[gcvAr]);
        const pGcvAf = parseNum(perfRow[gcvAf]);
        const pGhr = parseNum(perfRow[ghrDir]);
        const pLoiBa = parseNum(perfRow[loiBa]);
        const pLoiFa = parseNum(perfRow[loiFa]);
        const pFc = parseNum(perfRow[fc]);
        const pVm = parseNum(perfRow[vm]);

        await pool.query(`
            INSERT INTO daily_performance (
                plant_id, entry_date, 
                gcv_ar, gcv_af, ghr_direct, loi_ba, loi_fa, fc_pct, vm_pct, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved')
            ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                gcv_ar=EXCLUDED.gcv_ar,
                gcv_af=EXCLUDED.gcv_af,
                ghr_direct=EXCLUDED.ghr_direct,
                loi_ba=EXCLUDED.loi_ba,
                loi_fa=EXCLUDED.loi_fa,
                fc_pct=EXCLUDED.fc_pct,
                vm_pct=EXCLUDED.vm_pct,
                status='approved'
        `, [plantId, entryDate, pGcvAr, pGcvAf, pGhr, pLoiBa, pLoiFa, pFc, pVm]);
    }

    console.log("Successfully seeded performance & ash historical records.");
    pool.end();
}

run();
