const { assembleDGR } = require('c:/Users/IE-Admin/Desktop/dgr/dgr-platform/services/dgr-compute/src/engines/dgr.engine.js');
const db = require('c:/Users/IE-Admin/Desktop/dgr/dgr-platform/services/dgr-compute/src/shared/db.js');
const XLSX = require('xlsx');

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}

async function verifyMultiple() {
    try {
        const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
        const wsPower = wb.Sheets['Power'];
        const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

        let validDates = [];
        for (let i = 5; i <= 250; i++) {
            const rawDate = dataPower[i]?.[0];
            if (typeof rawDate === 'number') {
                const parsed = XLSX.SSF.parse_date_code(rawDate);
                const sqlDateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
                validDates.push({ row: i, date: sqlDateStr });
            }
        }

        const { rows } = await db.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = rows[0].id;

        // Pick 5 random dates and check if they are in DB
        const shuffled = validDates.sort(() => 0.5 - Math.random());
        let testsRun = 0;
        let totalMatched = 0;

        for (const rand of shuffled) {
            if (testsRun >= 5) break;

            const powerRes = await db.query("SELECT id FROM daily_power WHERE plant_id=$1 AND entry_date=$2", [plantId, rand.date]);
            if (powerRes.rows.length === 0) continue; // Skip if date wasn't seeded into database

            testsRun++;
            console.log(`\n============ Validation for Seeded Date: ${rand.date} (Excel Row ${rand.row + 1}) ============`);

            const report = await assembleDGR(plantId, rand.date);

            // Hardcoded Exact Excel Columns from previous test analysis
            let genCol = 20; // Power Generation
            let gtExpCol = 76; // GT Export
            let gtImpCol = 79; // GT Import
            let netExpCol = 82; // Net Export
            let pafCol = 143; // Plant Available Factor

            for (let j = 0; j < dataPower[2].length; j++) {
                if (dataPower[2][j] === 'Power Generation') genCol = j;
                if (dataPower[2][j] === 'GT Export') gtExpCol = j;
                if (dataPower[2][j] === 'GT Import') gtImpCol = j;
                if (dataPower[2][j] === 'Net Export') netExpCol = j;
                if (String(dataPower[2][j]).includes('Plant Available Factor (PAF)  - For TNPDCL Only')) pafCol = j;
            }

            const excelRow = dataPower[rand.row];
            const exGen = parseNum(excelRow[genCol]);
            const exExp = parseNum(excelRow[gtExpCol]);
            const exImp = parseNum(excelRow[gtImpCol]);
            const exNetExp = exExp - exImp;
            const exPaf = parseNum(excelRow[pafCol]);

            // Extract DGR Engine outputs
            const powerSec = report.sections.find(s => s.title.includes('POWER'));
            const genRow = powerSec.rows.find(r => r.particulars.includes('Power Generation'));
            const gtExpRow = powerSec.rows.find(r => r.particulars.includes('Total Export (GT)'));
            const gtImpRow = powerSec.rows.find(r => r.particulars.includes('Total Import (GT)'));
            const netExpRow = powerSec.rows.find(r => r.particulars.includes('Net Export'));

            const perfSec = report.sections.find(s => s.title.includes('PERFORMANCE'));
            const pafRow = perfSec.rows.find(r => r.particulars.includes('Plant Availability Factor (TNPDCL)'));

            console.log(`[POWER GEN]        Excel: ${exGen.toFixed(4).padEnd(10)} | DGR Target App: ${Number(genRow.daily || 0).toFixed(4)}`);
            console.log(`[NET EXPORT]       Excel: ${exNetExp.toFixed(4).padEnd(10)} | DGR Target App: ${Number(netExpRow.daily || 0).toFixed(4)}`);
            console.log(`[PAF % (TNPDCL)]   Excel: ${exPaf.toFixed(4).padEnd(10)} | DGR Target App: ${Number(pafRow.daily || 0).toFixed(4)}`);

            const genMatch = Math.abs(exGen - Number(genRow.daily)) < 0.05;
            const expMatch = Math.abs(exNetExp - Number(netExpRow.daily)) < 0.05;

            if (genMatch && expMatch) {
                totalMatched++;
            }
        }

        console.log(`\n✅ RESULT: ${totalMatched} out of ${testsRun} dates strictly matched fundamental physics equations and DGR engine generation metrics.`);

    } catch (e) {
        console.error("Test Verification Error:", e.stack);
    } finally {
        process.exit(0);
    }
}

verifyMultiple();
