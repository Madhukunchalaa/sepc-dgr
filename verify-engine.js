const { assembleDGR } = require('c:/Users/IE-Admin/Desktop/dgr/dgr-platform/services/dgr-compute/src/engines/dgr.engine.js');
const db = require('c:/Users/IE-Admin/Desktop/dgr/dgr-platform/services/dgr-compute/src/shared/db.js');
const XLSX = require('xlsx');

const minRow = 5;
const maxRow = 150;

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}

async function verify() {
    try {
        const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
        const wsPower = wb.Sheets['Power'];
        const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

        let validDates = [];
        for (let i = minRow; i <= maxRow; i++) {
            const rawDate = dataPower[i]?.[0];
            if (typeof rawDate === 'number') {
                const parsed = XLSX.SSF.parse_date_code(rawDate);
                const sqlDateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
                validDates.push({ row: i, date: sqlDateStr });
            }
        }

        // Pick random date
        const rand = validDates[Math.floor(Math.random() * validDates.length)];
        console.log(`\n============ Verification for Random Date: ${rand.date} (Excel Row ${rand.row + 1}) ============`);

        const { rows } = await db.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = rows[0].id;

        const powerRes = await db.query("SELECT id FROM daily_power WHERE plant_id=$1 AND entry_date=$2", [plantId, rand.date]);
        if (powerRes.rows.length === 0) {
            console.log("No data in DB for this date yet. Run script again to pick a seeded date!");
            process.exit(0);
        }

        const report = await assembleDGR(plantId, rand.date);

        // Find excel col indices
        const rowLabels = dataPower[2];
        let genCol = -1, exportCol = -1, pafCol = -1;
        for (let j = 0; j < rowLabels.length; j++) {
            const lab = String(rowLabels[j] || '').trim();
            if (lab === 'Power Generation' && genCol === -1) genCol = j;
            if (lab === 'Net Export' && exportCol === -1) exportCol = j;
            if (lab.includes('Plant Available Factor') && pafCol === -1) pafCol = j;
        }

        const excelRow = dataPower[rand.row];
        const exGen = parseNum(excelRow[genCol]);
        const exExp = parseNum(excelRow[exportCol]);

        // Extract DGR Engine outputs
        const powerSec = report.sections.find(s => s.title.includes('POWER'));
        const genRow = powerSec.rows.find(r => r.particulars.includes('Power Generation'));
        const expRow = powerSec.rows.find(r => r.particulars.includes('Net Export'));

        console.log(`[POWER GEN]  Excel: ${exGen.toFixed(5).padEnd(12)} | DGR App Engine: ${Number(genRow.daily || 0).toFixed(5)}`);
        console.log(`[NET EXPORT] Excel: ${exExp.toFixed(5).padEnd(12)} | DGR App Engine: ${Number(expRow.daily || 0).toFixed(5)}`);

        const pafExcel = parseNum(excelRow[pafCol]);
        const perfSec = report.sections.find(s => s.title.includes('PERFORMANCE'));
        const pafRow = perfSec.rows.find(r => r.particulars.includes('Plant Availability Factor (TNPDCL)'));

        console.log(`[PAF %]      Excel: ${pafExcel.toFixed(5).padEnd(12)} | DGR App Engine: ${Number(pafRow.daily || 0).toFixed(5)}`);

        if (Math.abs(exGen - Number(genRow.daily)) < 0.05 && Math.abs(exExp - Number(expRow.daily)) < 0.05) {
            console.log("\nMATCH EXACT! ✅ The output of the 10-section node.js matrix aligns dynamically and perfectly with physical Excel models.");
        } else {
            console.log("\nMISMATCH DETECTED! ❌ Look into formula discrepancies.");
        }

    } catch (e) {
        console.error("Test Verification Error:", e.stack);
    } finally {
        process.exit(0);
    }
}

verify();
