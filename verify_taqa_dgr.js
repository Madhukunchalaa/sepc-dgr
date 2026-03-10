require('dotenv').config();
const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');
const { getPlant } = require('./services/dgr-compute/src/engines/helpers');

async function test() {
    try {
        const plant = await getPlant('36cd41f9-b150-46da-a778-a838679a343f');
        const targetDate = '2026-03-09';
        console.log(`🚀 Generating TAQA DGR for ${targetDate}...`);
        const report = await assembleTaqaDGR(plant, targetDate);

        let totalRows = 0;
        report.sections.forEach((s, idx) => {
            console.log(`\nSection ${idx + 1}: ${s.title}`);
            if (!s.rows) {
                console.log(`  ❌ Error: Section ${s.title} has no rows!`);
                console.log('  Section object:', JSON.stringify(s, null, 2));
                return;
            }
            s.rows.forEach(r => {
                console.log(`  SN ${r.sn}: ${r.particulars} (${r.uom}) -> D: ${r.daily}, M: ${r.mtd}, Y: ${r.ytd}`);
                totalRows++;
            });
        });

        console.log(`\n✅ Total Rows: ${totalRows}`);
        if (totalRows >= 75) {
            console.log("🌟 PASS: 75+ fields present.");
        } else {
            console.log(`❌ FAIL: Only ${totalRows} fields present.`);
        }
    } catch (err) {
        console.error("💥 Error during report generation:", err);
    }
}

test().then(() => process.exit());
