require('dotenv').config();
const { Pool } = require('pg');
const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');

const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function verifyExcelMatch() {
    try {
        console.log("--- TAQA EXCEL MATCHING VERIFICATION (V2) ---");
        const plant = { id: '78920445-14de-4144-b736-8dc7a5849ca1', fy_label: '2025-26', company_name: 'MEIL Neyveli Energy Pvt Ltd', name: 'TAQA Plant' };
        const date = '2025-04-01';

        const report = await assembleTaqaDGR(plant, date);

        const check = (label, expected) => {
            let actual = null;
            for (const s of report.sections) {
                const r = s.rows.find(row => row.particulars.startsWith(label));
                if (r) { actual = r.daily; break; }
            }
            if (actual === null) {
                console.log(`[CHECK] ${label.padEnd(40)} | ❌ NOT FOUND`);
                return;
            }
            const actualNum = Number(actual);
            const diff = Math.abs(actualNum - expected);
            const status = diff < 0.005 ? "✅ MATCH" : `❌ MISMATCH (Actual: ${actualNum})`;
            console.log(`[CHECK] ${label.padEnd(40)} | Expected: ${expected.toFixed(4)} | ${status}`);
        };

        console.log("\nComparison with Excel Daily Column:");
        check("Rated Capacity", 6.0000);
        check("Declared Capacity", 0.4070);
        check("Gross Generation", 4.5520);
        check("Net Export", 4.1714);
        check("Auxiliary Consumption", 0.3806);
        check("Auxiliary Power Consumption (APC)", 0.0836);
        check("Plant Load Factor (PLF)", 0.7587);
        check("HFO Consumption", 3.1266);
        check("Sp Oil Consumption", 0.7268);
        check("Lignite Consumption", 4869.0000);
        check("Sp Lignite Consumption", 1.0696);
        check("GHR (As Fired)", 2794.6214);

        console.log("\n✨ Verification results generated.");

    } catch (e) {
        console.error("Verification Error:", e);
    } finally {
        await pool.end();
    }
}

verifyExcelMatch();
