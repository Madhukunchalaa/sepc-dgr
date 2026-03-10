const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');
const helpers = require('./services/dgr-compute/src/engines/helpers');

// Monkey-patch helpers to return Excel daily values
helpers.getPlant = async () => ({ id: '78920445-14de-4144-b736-8dc7a5849ca1', short_name: 'TAQA', name: 'TAQA Plant', company_name: 'MEIL Neyveli Energy Pvt Ltd' });
helpers.getPowerData = async () => ({ generation_mu: 4.5520, export_mu: 4.1714, import_mu: 0.0000, apc_pct: 0.0836, plf_daily: 0.7587, hours_on_grid: 24, forced_outages: 0 });
helpers.getSchedulingData = async () => ({ dc_sepc_mu: 0.4070, sg_ppa_mu: 4.1714, sg_rtm_mu: 1.4400, deemed_gen_mu: 6.0000 });
helpers.getFuelData = async () => ({ coal_cons_mt: 4869, hfo_cons_kl: 3.30857 }); // 3.30857 * 0.945 = 3.1266 MT
helpers.getPerfData = async () => ({ gcv_af: 2612.7 });
helpers.getAvailabilityData = async () => ({ paf_pct: 0.0678 });
helpers.getWaterData = async () => ({ dm_generation_m3: 0, dm_total_cons_m3: 437 });
helpers.getAshData = async () => ({ fa_generated_mt: 2580, fa_to_user_mt: 268.2468 });
helpers.getMTDSum = async () => 12.9940; // For MTD Gen
helpers.getYTDSum = async () => 1304.1757; // For YTD Gen
helpers.getSubmissionStatus = async () => 'submitted';

async function test() {
    console.log("--- TAQA ENGINE VS EXCEL VERIFICATION ---");
    const report = await assembleTaqaDGR('78920445-14de-4144-b736-8dc7a5849ca1', '2025-04-01');

    const findVal = (p) => {
        for (const s of report.sections) {
            const r = s.rows.find(row => row.particulars.includes(p));
            if (r) return r.daily;
        }
        return null;
    };

    const expected = {
        "Rated Capacity": 6.0,
        "Declared Capacity": 0.4070,
        "Gross Generation": 4.5520,
        "Net Export": 4.1714,
        "APC": 0.0836, // (4.552 - 4.1714)/4.552 = 0.0836
        "PAF": 0.0678,
        "PLF": 0.7587,
        "HFO Consumption": 3.1266, // 3.30857 * 0.945
        "Sp Oil": 0.7268, // 3.30857 / 4.552
        "Lignite": 4869,
        "Sp Lignite": 1.0696, // 4869 / 4552
        "GHR": 2794.6 // 2612.7 * 1.0696 
    };

    let allMatch = true;
    for (const [k, v] of Object.entries(expected)) {
        const actual = findVal(k);
        const diff = Math.abs(actual - v);
        const match = diff < 0.001 ? "✅ MATCH" : `❌ MISMATCH (Actual: ${actual})`;
        console.log(`${k.padEnd(20)} | Expected: ${v.toFixed(4)} | ${match}`);
        if (diff >= 0.001) allMatch = false;
    }

    if (allMatch) console.log("\n✨ CONGRATULATIONS! TAQA Engine exactly matches Excel daily values.");
    else console.log("\n⚠️ Some values still mismatch.");
}

test();
