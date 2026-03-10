const path = require('path');
let helpers;
try {
    helpers = require(path.join(__dirname, 'helpers.js'));
} catch (e) {
    console.error('CRITICAL: Failed to load helpers from taqa.engine.js using path.join', e);
    try {
        helpers = require('./helpers');
    } catch (e2) {
        console.error('CRITICAL: Fallback require("./helpers") also failed', e2);
        throw new Error(`Module resolution failed in taqa.engine.js: ${e2.message}`);
    }
}
const { getTaqaStats, getFYStartDate, getSubmissionStatus, processNumbers, query, getPlant } = helpers;

async function assembleTaqaDGR(plant, targetDate) {
    console.log(`[taqa.engine] Assembling DGR for ${plant?.short_name} on ${targetDate}`);
    const plantId = plant.id;
    const date = new Date(targetDate);
    const dayOfMonth = date.getDate();
    const fyStartDate = await getFYStartDate(plantId, targetDate);

    // Derive FY Label (e.g. 2025-2026)
    const fyDate = new Date(fyStartDate);
    const fyYear = fyDate.getFullYear();
    const fyLabel = `${fyYear}-${fyYear + 1}`;

    const daysSinceFyStart = Math.floor((date - fyDate) / (1000 * 60 * 60 * 24)) + 1;

    // 1. Fetch Day's Raw Data & Bulk Stats (MTD/YTD sums)
    const [rawRes, stats, submissionStatus] = await Promise.all([
        query('SELECT * FROM taqa_daily_input WHERE plant_id=$1 AND entry_date=$2', [plantId, targetDate]),
        getTaqaStats(plantId, targetDate),
        getSubmissionStatus(plantId, targetDate)
    ]);

    if (!rawRes.rows.length) {
        const err = new Error('No TAQA data for this date. Enter Ops Input first.');
        err.code = 'TAQA_NO_DATA';
        throw err;
    }
    const r = rawRes.rows[0];
    const m = stats.mtd || {};
    const y = stats.ytd || {};

    // 2. Constants & Common Helpers
    const CAPACITY_MW = 250;
    const DP_MU = (CAPACITY_MW * 24 / 1000); // 6.0 MU
    const pct = (num, den) => (den != null && Number(den) > 0) ? (Number(num) / Number(den)) : 0;
    const mu = (val) => Number(val || 0) / 1000;
    const N = (val) => Number(val || 0);

    // gen_main_meter in TAQA is already the DAILY absolute generation in MWh.
    // We just need to convert it to MU (1 MU = 1000 MWh).
    const dailyGenMWhr = N(r.gen_main_meter);
    const dailyGenMu = dailyGenMWhr / 1000;

    // Derived Metrics for sections
    const calcAux = (gen, exp, imp) => Math.max(0, gen - exp + imp);
    const calcSpOil = (oilMt, genMu) => genMu > 0 ? (oilMt / genMu) * 1000 : 0; // ml/kWh
    const calcSpLig = (ligMt, genMu) => genMu > 0 ? (ligMt / (genMu * 1000)) : 0; // kg/kWh

    // ── Row Definitions ──────────────────────────────────────────────────────────

    const genRows = [
        { sn: "1", particulars: "Rated Capacity", uom: "MU", daily: DP_MU, mtd: DP_MU * dayOfMonth, ytd: DP_MU * daysSinceFyStart },
        { sn: "2", particulars: "Declared Capacity", uom: "MU", daily: mu(r.declared_capacity_mwhr), mtd: mu(m.declared_capacity_mwhr), ytd: mu(y.declared_capacity_mwhr) },
        { sn: "3", particulars: "Dispatch Demand", uom: "MU", daily: mu(r.dispatch_demand_mwhr), mtd: mu(m.dispatch_demand_mwhr), ytd: mu(y.dispatch_demand_mwhr) },
        { sn: "4", particulars: "Schedule Generation", uom: "MU", daily: mu(r.schedule_gen_mldc), mtd: mu(m.schedule_gen_mldc), ytd: mu(y.schedule_gen_mldc) },
        // dailyGenMu = delta of cumulative meter (today - yesterday), safe for outage days
        { sn: "5", particulars: "Gross Generation", uom: "MU", daily: dailyGenMu, mtd: mu(m.gen_main_meter), ytd: mu(y.gen_main_meter) },
        { sn: "6", particulars: "Deemed Generation", uom: "MU", daily: mu(r.deemed_gen_mwhr), mtd: mu(m.deemed_gen_mwhr), ytd: mu(y.deemed_gen_mwhr) },
        {
            sn: "7", particulars: "Auxiliary Consumption", uom: "MU",
            daily: calcAux(dailyGenMu, mu(r.net_export), mu(r.net_import_sy)),
            mtd: calcAux(mu(m.gen_main_meter), mu(m.net_export), mu(m.net_import_sy)),
            ytd: calcAux(mu(y.gen_main_meter), mu(y.net_export), mu(y.net_import_sy))
        },
        { sn: "8", particulars: "Net Import", uom: "MU", daily: mu(r.net_import_sy), mtd: mu(m.net_import_sy), ytd: mu(y.net_import_sy) },
        { sn: "9", particulars: "Net Export", uom: "MU", daily: mu(r.net_export), mtd: mu(m.net_export), ytd: mu(y.net_export) },
    ];

    const kpiRows = [
        {
            sn: "10", particulars: "Auxiliary Power Consumption (APC)", uom: "%",
            daily: pct(calcAux(dailyGenMu, mu(r.net_export), mu(r.net_import_sy)), dailyGenMu),
            mtd: pct(calcAux(mu(m.gen_main_meter), mu(m.net_export), mu(m.net_import_sy)), mu(m.gen_main_meter)),
            ytd: pct(calcAux(mu(y.gen_main_meter), mu(y.net_export), mu(y.net_import_sy)), mu(y.gen_main_meter))
        },
        { sn: "11", particulars: "Plant Availability Factor (PAF)", uom: "%", daily: pct(mu(r.declared_capacity_mwhr), DP_MU), mtd: pct(mu(m.declared_capacity_mwhr), DP_MU * dayOfMonth), ytd: pct(mu(y.declared_capacity_mwhr), DP_MU * daysSinceFyStart) },
        { sn: "12", particulars: "Plant Load Factor (PLF)", uom: "%", daily: pct(dailyGenMu, DP_MU), mtd: pct(mu(m.gen_main_meter), DP_MU * dayOfMonth), ytd: pct(mu(y.gen_main_meter), DP_MU * daysSinceFyStart) },
        {
            sn: "13", particulars: "Forced Outage Rate (FOR)", uom: "%",
            daily: pct(N(r.forced_outage_hrs), (N(r.total_hours) - N(r.scheduled_outage_hrs))),
            mtd: pct(N(m.forced_outage_hrs), (N(m.total_hours) - N(m.scheduled_outage_hrs))),
            ytd: pct(N(y.forced_outage_hrs), (N(y.total_hours) - N(y.scheduled_outage_hrs)))
        },
        { sn: "14", particulars: "Scheduled Outage Factor (SOF)", uom: "%", daily: pct(N(r.scheduled_outage_hrs), N(r.total_hours)), mtd: pct(m.scheduled_outage_hrs, m.total_hours), ytd: pct(y.scheduled_outage_hrs, y.total_hours) },
        { sn: "15", particulars: "Dispatch Demand (DD)", uom: "%", daily: pct(mu(r.schedule_gen_mldc), mu(r.declared_capacity_mwhr)), mtd: pct(mu(m.schedule_gen_mldc), mu(m.declared_capacity_mwhr)), ytd: pct(mu(y.schedule_gen_mldc), mu(y.declared_capacity_mwhr)) },
        { sn: "16", particulars: "Ex Bus Schedule Generation (SG)", uom: "%", daily: 1, mtd: 1, ytd: 1 }, // Placeholder
    ];

    const hourRows = [
        { sn: "17", particulars: "Unit trip", uom: "No's", daily: N(r.no_unit_trips), mtd: N(m.no_unit_trips), ytd: N(y.no_unit_trips) },
        { sn: "18", particulars: "Unit Shutdown", uom: "No's", daily: N(r.no_unit_shutdown), mtd: N(m.no_unit_shutdown), ytd: N(y.no_unit_shutdown) },
        { sn: "19", particulars: "Unit On Grid", uom: "hrs", daily: N(r.dispatch_duration), mtd: N(m.dispatch_duration), ytd: N(y.dispatch_duration) },
        { sn: "20", particulars: "Load Backdown - 170MW", uom: "hrs", daily: N(r.load_backdown_duration), mtd: N(m.load_backdown_duration), ytd: N(y.load_backdown_duration) },
        { sn: "21", particulars: "Unit on standby - RSD", uom: "hrs", daily: N(r.unit_standby_hrs), mtd: N(m.unit_standby_hrs), ytd: N(y.unit_standby_hrs) },
        { sn: "22", particulars: "Scheduled Outage", uom: "hrs", daily: N(r.scheduled_outage_hrs), mtd: N(m.scheduled_outage_hrs), ytd: N(y.scheduled_outage_hrs) },
        { sn: "23", particulars: "Forced Outage", uom: "hrs", daily: N(r.forced_outage_hrs), mtd: N(m.forced_outage_hrs), ytd: N(y.forced_outage_hrs) },
        { sn: "24", particulars: "De-rated Equivalent Outage", uom: "hrs", daily: N(r.derated_outage_hrs), mtd: N(m.derated_outage_hrs), ytd: N(y.derated_outage_hrs) },
    ];

    const hfo_cons = (N(r.hfo_supply_int_rdg) - N(r.hfo_return_int_rdg)) * 0.945 / 1000;
    const m_hfo_cons = (N(m.hfo_supply_int_rdg) - N(m.hfo_return_int_rdg)) * 0.945 / 1000;
    const y_hfo_cons = (N(y.hfo_supply_int_rdg) - N(y.hfo_return_int_rdg)) * 0.945 / 1000;

    const fuelRows = [
        { sn: "25", particulars: "HFO Consumption", uom: "MT", daily: hfo_cons, mtd: m_hfo_cons, ytd: y_hfo_cons },
        { sn: "26", particulars: "HFO Receipt", uom: "MT", daily: N(r.hfo_receipt_mt), mtd: N(m.hfo_receipt_mt), ytd: N(y.hfo_receipt_mt) },
        { sn: "27", particulars: "HFO Stock", uom: "MT", daily: N(r.hfo_t10_lvl_calc) + N(r.hfo_t20_lvl_calc), mtd: null, ytd: null },
        { sn: "28", particulars: "Sp Oil Consumption", uom: "ml/kWh", daily: calcSpOil(hfo_cons, dailyGenMu), mtd: calcSpOil(m_hfo_cons, mu(m.gen_main_meter)), ytd: calcSpOil(y_hfo_cons, mu(y.gen_main_meter)) },
        { sn: "29", particulars: "Lignite Consumption", uom: "MT", daily: N(r.lignite_receipt_taqa_wb), mtd: N(m.lignite_receipt_taqa_wb), ytd: N(y.lignite_receipt_taqa_wb) },
        { sn: "30", particulars: "Lignite Receipt", uom: "MT", daily: N(r.lignite_receipt_taqa_wb), mtd: N(m.lignite_receipt_taqa_wb), ytd: N(y.lignite_receipt_taqa_wb) },
        { sn: "31", particulars: "Lignite Stock at Plant", uom: "MT", daily: N(r.lignite_vadallur_silo), mtd: null, ytd: null },
        { sn: "32", particulars: "Sp Lignite Consumption", uom: "kg/kWh", daily: calcSpLig(N(r.lignite_receipt_taqa_wb), dailyGenMu), mtd: calcSpLig(N(m.lignite_receipt_taqa_wb), mu(m.gen_main_meter)), ytd: calcSpLig(N(y.lignite_receipt_taqa_wb), mu(y.gen_main_meter)) },
        { sn: "33", particulars: "Lignite Lifted from NLC", uom: "MT", daily: N(r.lignite_lifted_nlcil_wb), mtd: N(m.lignite_lifted_nlcil_wb), ytd: N(y.lignite_lifted_nlcil_wb) },
        { sn: "34", particulars: "HSD Consumption", uom: "kl", daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl), mtd: N(m.hsd_t30_receipt_kl) + N(m.hsd_t40_receipt_kl), ytd: N(y.hsd_t30_receipt_kl) + N(y.hsd_t40_receipt_kl) },
        { sn: "35", particulars: "HSD Receipt", uom: "kl", daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl), mtd: N(m.hsd_t30_receipt_kl) + N(m.hsd_t40_receipt_kl), ytd: N(y.hsd_t30_receipt_kl) + N(y.hsd_t40_receipt_kl) },
        { sn: "36", particulars: "HSD Stock", uom: "kl", daily: N(r.hsd_t30_lvl) + N(r.hsd_t40_lvl), mtd: null, ytd: null },
    ];

    const hrRows = [
        { sn: "37", particulars: "Fuel master Avg at FLC", uom: "%", daily: N(r.fuel_master_250mw), mtd: pct(N(m.fuel_master_250mw), m.days), ytd: pct(N(y.fuel_master_250mw), y.days) },
        { sn: "38", particulars: "GCV (As Fired)", uom: "kcal/kg", daily: N(r.chem_gcv_nlcil), mtd: pct(N(m.chem_gcv_nlcil), m.days), ytd: pct(N(y.chem_gcv_nlcil), y.days) },
        {
            sn: "39", particulars: "GHR (As Fired)", uom: "kcal/kWh",
            daily: calcSpLig(N(r.lignite_receipt_taqa_wb), dailyGenMu) * N(r.chem_gcv_nlcil),
            mtd: calcSpLig(N(m.lignite_receipt_taqa_wb), mu(m.gen_main_meter)) * pct(N(m.chem_gcv_nlcil), m.days),
            ytd: calcSpLig(N(y.lignite_receipt_taqa_wb), mu(y.gen_main_meter)) * pct(N(y.chem_gcv_nlcil), y.days)
        },
        { sn: "40", particulars: "Lignite Consumption (Normative)", uom: "MT", daily: 0, mtd: 0, ytd: 0 },
        { sn: "41", particulars: "Lignite Normative (-) loss", uom: "MT", daily: 0, mtd: 0, ytd: 0 },
        { sn: "42", particulars: "LOI in Bottom ash", uom: "%", daily: N(r.chem_ubc_bottom_ash), mtd: pct(N(m.chem_ubc_bottom_ash), m.days), ytd: pct(N(y.chem_ubc_bottom_ash), y.days) },
        { sn: "43", particulars: "LOI in Fly ash", uom: "%", daily: N(r.chem_ubc_fly_ash), mtd: pct(N(m.chem_ubc_fly_ash), m.days), ytd: pct(N(y.chem_ubc_fly_ash), y.days) },
    ];

    const waterRows = [
        { sn: "44", particulars: "DM water Production", uom: "M3", daily: N(r.dm_water_prod_m3), mtd: N(m.dm_water_prod_m3), ytd: N(y.dm_water_prod_m3) },
        { sn: "45", particulars: "DM water Consumption for main boiler", uom: "M3", daily: N(r.dm_to_condenser), mtd: N(m.dm_to_condenser), ytd: N(y.dm_to_condenser) },
        { sn: "46", particulars: "DM Water Consumption for total plant", uom: "M3", daily: N(r.dm_to_condenser) + N(r.cst_to_main_unit), mtd: N(m.dm_to_condenser) + N(m.cst_to_main_unit), ytd: N(y.dm_to_condenser) + N(y.cst_to_main_unit) },
        { sn: "47", particulars: "Service Water Consumption", uom: "M3", daily: N(r.service_water_flow), mtd: N(m.service_water_flow), ytd: N(y.service_water_flow) },
        { sn: "48", particulars: "Seal water Consumption", uom: "M3", daily: N(r.seal_water_supply), mtd: N(m.seal_water_supply), ytd: N(y.seal_water_supply) },
        { sn: "49", particulars: "Potable Water Consumption", uom: "M3", daily: N(r.potable_tank_makeup), mtd: N(m.potable_tank_makeup), ytd: N(y.potable_tank_makeup) },
        { sn: "50", particulars: "Bore well water consumption", uom: "M3", daily: N(r.borewell_to_reservoir) + N(r.borewell_to_cw_forebay), mtd: N(m.borewell_to_reservoir) + N(m.borewell_to_cw_forebay), ytd: N(y.borewell_to_reservoir) + N(y.borewell_to_cw_forebay) },
        { sn: "51", particulars: "Ash water reuse to CW forebay", uom: "M3", daily: N(r.ash_pond_overflow), mtd: N(m.ash_pond_overflow), ytd: N(y.ash_pond_overflow) },
        { sn: "52", particulars: "Cooling water blow down", uom: "M3", daily: N(r.cw_blowdown), mtd: N(m.cw_blowdown), ytd: N(y.cw_blowdown) },
        { sn: "53", particulars: "Cooling water blow down rate", uom: "M3/hr", daily: pct(N(r.cw_blowdown), 24), mtd: pct(N(m.cw_blowdown), m.days * 24), ytd: pct(N(y.cw_blowdown), y.days * 24) },
        { sn: "54", particulars: "Total Water consumption", uom: "M3/MWh", daily: pct(N(r.service_water_flow), dailyGenMu * 1000), mtd: pct(N(m.service_water_flow), mu(m.gen_main_meter) * 1000), ytd: pct(N(y.service_water_flow), mu(y.gen_main_meter) * 1000) },
        { sn: "55", particulars: "Raw Water Consumption Rate", uom: "M3/MWh", daily: 0, mtd: 0, ytd: 0 },
        { sn: "56", particulars: "Ash water reuse rate", uom: "M3/MWh", daily: 0, mtd: 0, ytd: 0 },
        { sn: "57", particulars: "H2 Consumption", uom: "No's", daily: N(r.h2_cylinders), mtd: N(m.h2_cylinders), ytd: N(y.h2_cylinders) },
        { sn: "58", particulars: "O2 Consumption", uom: "No's", daily: N(r.o2_cylinders), mtd: N(m.o2_cylinders), ytd: N(y.o2_cylinders) },
    ];

    const ashGen = (N(r.lignite_receipt_taqa_wb) * N(r.chem_ash_pct)) / 100;
    const m_ashGen = (N(m.lignite_receipt_taqa_wb) * pct(N(m.chem_ash_pct), m.days)) / 100;
    const y_ashGen = (N(y.lignite_receipt_taqa_wb) * pct(N(y.chem_ash_pct), y.days)) / 100;

    const ashRows = [
        { sn: "59", particulars: "Ash Generation", uom: "MT", daily: ashGen, mtd: m_ashGen, ytd: y_ashGen },
        { sn: "60", particulars: "Fly ash Generation", uom: "MT", daily: ashGen * 0.8, mtd: m_ashGen * 0.8, ytd: y_ashGen * 0.8 },
        { sn: "61", particulars: "Fly Ash Quantity to cement plant", uom: "MT", daily: N(r.chem_ash_sales_mt), mtd: N(m.chem_ash_sales_mt), ytd: N(y.chem_ash_sales_mt) },
        { sn: "62", particulars: "Fly ash Quantity to ash Dyke", uom: "MT", daily: N(r.fa_to_ash_pond_mt), mtd: N(m.fa_to_ash_pond_mt), ytd: N(y.fa_to_ash_pond_mt) },
        { sn: "63", particulars: "Fly ash in Silo Quantity", uom: "MT", daily: N(r.fa_silo_lvl_pct), mtd: null, ytd: null },
        { sn: "64", particulars: "Fly ash Sale", uom: "%", daily: pct(N(r.chem_ash_sales_mt), ashGen * 0.8), mtd: pct(N(m.chem_ash_sales_mt), m_ashGen * 0.8), ytd: pct(N(y.chem_ash_sales_mt), y_ashGen * 0.8) },
        { sn: "65", particulars: "Fly Ash trucks to cement plant", uom: "No's", daily: N(r.fa_trucks), mtd: N(m.fa_trucks), ytd: N(y.fa_trucks) },
        { sn: "66", particulars: "Bottom ash Generation", uom: "MT", daily: ashGen * 0.2, mtd: m_ashGen * 0.2, ytd: y_ashGen * 0.2 },
        { sn: "67", particulars: "Bottom ash trucks (internal)", uom: "No's", daily: N(r.ba_trucks_internal), mtd: N(m.ba_trucks_internal), ytd: N(y.ba_trucks_internal) },
        { sn: "68", particulars: "Bottom ash trucks (External)", uom: "No's", daily: N(r.ba_trucks_external), mtd: N(m.ba_trucks_external), ytd: N(y.ba_trucks_external) },
        { sn: "69", particulars: "Bottom Ash disposal", uom: "MT / %", daily: 0, mtd: 0, ytd: 0 },
    ];

    const envRows = [
        { sn: "76", particulars: "Grid Frequency (Max / Min)", uom: "Hz", daily: `${N(r.grid_freq_max)} / ${N(r.grid_freq_min)}`, mtd: null, ytd: null },
        { sn: "77", particulars: "Ambient Temp (Max / Min)", uom: "Deg C", daily: `${N(r.ambient_temp_max)} / ${N(r.ambient_temp_min)}`, mtd: null, ytd: null },
        { sn: "78", particulars: "Relative Humidity (Max / Min)", uom: "%", daily: `${N(r.humidity_max)} / ${N(r.humidity_min)}`, mtd: null, ytd: null },
        { sn: "70", particulars: "DSM Charges (payable / receivables)", uom: "Lac", daily: mu(r.dsm_charges), mtd: mu(m.dsm_charges), ytd: mu(y.dsm_charges) },
        { sn: "71", particulars: "Net Gain / Loss", uom: "Lac", daily: mu(r.net_gain_loss), mtd: mu(m.net_gain_loss), ytd: mu(y.net_gain_loss) },
        { sn: "72", particulars: "Fuel Saved / Loss", uom: "Lac", daily: mu(r.fuel_saved_loss), mtd: mu(m.fuel_saved_loss), ytd: mu(y.fuel_saved_loss) },
        { sn: "73", particulars: "Scheduled Generation Revision", uom: "No's", daily: N(r.no_load_pickup_inst) + N(r.no_load_backdown_inst), mtd: N(m.no_load_pickup_inst) + N(m.no_load_backdown_inst), ytd: N(y.no_load_pickup_inst) + N(y.no_load_backdown_inst) },
        { sn: "74", particulars: "Remarks - if any", uom: "text", daily: r.remarks || '—', mtd: null, ytd: null },
        { sn: "75", particulars: "Grid disturbance", uom: "text", daily: r.grid_disturbance || '—', mtd: null, ytd: null },
    ];

    const report = {
        header: {
            title: `DAILY GENERATION REPORT — ${fyLabel}`,
            company: plant?.company_name || 'MEIL Neyveli Energy Pvt Ltd',
            plantName: (plant?.name || 'TAQA Plant') + ' (1 X 250 MW)',
            documentNumber: plant?.document_number || 'TAQA/DGR/001',
            date: targetDate,
            dayName: date.toLocaleDateString('en-IN', { weekday: 'long' }),
            monthYear: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            fyLabel: plant?.fy_label || '',
        },
        sections: [
            { title: "1️⃣ GENERATION DETAILS", rows: genRows },
            { title: "2️⃣ PLANT KPI (%)", rows: kpiRows },
            { title: "3️⃣ UNIT STATUS / OUTAGE", rows: hourRows },
            { title: "4️⃣ FUEL PERFORMANCE", rows: fuelRows },
            { title: "5️⃣ HEAT RATE & WATER", rows: hrRows },
            { title: "6️⃣ WATER USAGES", rows: waterRows },
            { title: "7️⃣ ASH DETAILS", rows: ashRows },
            { title: "8️⃣ ENVIN, GRID & DSM", rows: envRows },
        ],
        meta: {
            submissionStatus,
            generatedAt: new Date().toISOString(),
            plantId,
            targetDate,
        },
    };

    report.sections = processNumbers(report.sections);
    return report;
}

module.exports = { assembleTaqaDGR };
