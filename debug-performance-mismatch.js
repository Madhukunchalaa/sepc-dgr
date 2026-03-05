const fs = require('fs');
const { assembleDGR } = require('./services/dgr-compute/src/engines/dgr.engine.js');
const { Pool } = require('pg');

const p = new Pool({ user: 'dgr_user', password: '1234', database: 'dgr_platform', port: 5432 });
require('dotenv').config({ path: './.env' });

async function run() {
    const { rows: pRows } = await p.query("SELECT id FROM plants WHERE short_name='TTPP' LIMIT 1");
    if (!pRows.length) return;
    const plantId = pRows[0].id;

    const dates = [{ sql: '2025-05-15', xl: '45792' }, { sql: '2025-06-12', xl: '45820' }, { sql: '2025-07-28', xl: '45866' }];
    const rawData = fs.readFileSync('excel_dumps.json', 'utf8');
    const excelDumps = JSON.parse(rawData.replace(/^\uFEFF/, ''));

    for (const dt of dates) {
        console.log(`\n\n=== DATE: ${dt.sql} ===`);
        const appDgr = await assembleDGR(plantId, dt.sql);
        const excelSectionRaw = excelDumps[dt.xl];

        const perfSection = appDgr.sections.find(s => s.title.includes('PERFORMANCE'));
        if (!perfSection) continue;

        for (const ap of perfSection.rows) {
            const cleanStr = s => s ? s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
            const appClean = cleanStr(ap.particulars);

            let exMatch = excelSectionRaw.find(e => cleanStr(e.particulars) === appClean || (appClean.length > 5 && cleanStr(e.particulars).startsWith(appClean)));

            if (ap.particulars === 'APC %') exMatch = null;
            if (ap.particulars === 'GT Export Make') exMatch = null;

            const exD = exMatch?.daily;
            const exM = exMatch?.mtd;
            const exY = exMatch?.ytd;

            const check = (exValue, appValue, colName) => {
                if (exValue == null && appValue == null) return;
                if (typeof exValue === 'number' && typeof appValue === 'number') {
                    let normalizedEx = exValue;
                    if (Math.abs(normalizedEx) < 2 && Math.abs(appValue) >= 10 && (ap.particulars.includes('Factor') || ap.particulars.includes('PAF') || ap.particulars.includes('Partial Loading'))) {
                        normalizedEx = normalizedEx * 100;
                    }
                    if (Math.abs(normalizedEx - appValue) > 0.1 && !ap.particulars.includes('GCV')) { // Very strict tolerance
                        console.log(`MISMATCH [${ap.particulars}] ${colName}: Excel=${normalizedEx.toFixed(4)}, App=${appValue.toFixed(4)}`);
                    }
                } else if (exValue != appValue && exValue != null && appValue != null) {
                    console.log(`TYPE/NULL MISMATCH [${ap.particulars}] ${colName}: Excel=${exValue}, App=${appValue}`);
                }
            };

            check(exD, ap.daily, 'DAILY');
            check(exM, ap.mtd, 'MTD');
            check(exY, ap.ytd, 'YTD');
        }
    }
    process.exit(0);
}

run().catch(console.error);
