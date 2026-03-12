require('dotenv').config();
const { query } = require('./services/data-entry/src/shared/db');
const taqaCtrl = require('./services/data-entry/src/controllers/taqa.controller');
const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');

const plantId = '78920445-14de-4144-b736-8dc7a5849ca1';
const date = '2025-04-01';

const excelDailyData = {
    gen_main_meter: 4552.0,
    net_export: 4171.4,
    net_import_sy: 0.0,
    declared_capacity_mwhr: 407.0,
    schedule_gen_mldc: 4171.4,
    dispatch_demand_mwhr: 1440.0,
    deemed_gen_mwhr: 6000.0,
    hfo_supply_int_rdg: 3308.57,
    hfo_return_int_rdg: 0.0,
    lignite_receipt_taqa_wb: 4869.0,
    chem_gcv_nlcil: 2612.7,
    dispatch_duration: 24.0,
    hfo_t10_lvl_calc: 100 // dummy
};

async function runFinalTest() {
    try {
        console.log("--- TAQA FINAL EXCEL-MATCHING E2E TEST ---");

        // 1. Mock the request objects for upsert and submit
        const mockRes = {
            status: () => mockRes,
            json: (data) => { if (data.message && data.message.includes('Fail')) console.error("API Error:", data) }
        };
        const mockUser = { id: '641e32e2-3e60-4520-887e-c22487f5d326' };

        console.log("1. Upserting Excel Daily Values...");
        await taqaCtrl.upsertEntry({ params: { plantId, date }, body: excelDailyData, user: mockUser }, mockRes);

        console.log("2. Calculating Derived Metrics (Submit)...");
        await taqaCtrl.submitEntry({ params: { plantId, date }, user: mockUser }, mockRes);

        console.log("3. Assembling DGR Report...");
        const report = await assembleTaqaDGR(plantId, date);

        // 4. Verification Table
        const check = (label, expected) => {
            let actual = null;
            for (const s of report.sections) {
                const r = s.rows.find(row => row.particulars === label);
                if (r) { actual = r.daily; break; }
            }
            const diff = Math.abs(Number(actual) - expected);
            const status = diff < 0.001 ? "✅ MATCH" : `❌ MISMATCH (Actual: ${actual})`;
            console.log(`${label.padEnd(35)} | Expected: ${expected.toFixed(4)} | ${status}`);
        };

        console.log("\n--- Comparison Results ---");
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

        console.log("\n✨ Final verification complete.");

    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        // process.exit(0);
    }
}

runFinalTest();
