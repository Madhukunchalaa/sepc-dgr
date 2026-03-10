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
    const fyStartDate = await getFYStartDate(plantId, targetDate);

    // Derive FY Label (e.g. 2025-2026)
    const fyDate = new Date(fyStartDate);
    const fyYear = fyDate.getFullYear();
    const fyLabel = `${fyYear}-${fyYear + 1}`;

    const daysSinceFyStart = Math.floor((date - fyDate) / (1000 * 60 * 60 * 24)) + 1;

    // 1. Fetch Window of Data (starts 1 day before FY start to get initial deltas)
    const windowStart = new Date(fyStartDate);
    windowStart.setDate(windowStart.getDate() - 1);

    const [allRes, submissionStatus] = await Promise.all([
        query(
            `SELECT * FROM taqa_daily_input 
             WHERE plant_id=$1 AND entry_date >= $2 AND entry_date <= $3 
             ORDER BY entry_date ASC`,
            [plantId, windowStart.toISOString().split('T')[0], targetDate]
        ),
        getSubmissionStatus(plantId, targetDate)
    ]);

    if (!allRes.rows.length || allRes.rows[allRes.rows.length - 1].entry_date.toISOString().split('T')[0] !== targetDate) {
        const err = new Error('No TAQA data for this date. Enter Ops Input first.');
        err.code = 'TAQA_NO_DATA';
        throw err;
    }

    // 2. Constants & Multipliers from Excel Analysis
    const CAPACITY_MW = 250;
    const DP_MU = (CAPACITY_MW * 24 / 1000); // 6.0 MU
    const MF_GEN = (18 * 12000 / 110);      // ~1963.636
    const MF_EXP = (230 / 110 * 500);       // ~1045.454

    const N = (val) => Number(val || 0);
    const delta = (currVal, prevVal) => {
        const c = N(currVal);
        const p = N(prevVal);
        if (p <= 0) return 0; // Match Excel IF logic
        return Math.max(0, c - p);
    };

    // 3. Process All Days in Window to get Daily Values
    const calculatedDays = [];
    for (let i = 0; i < allRes.rows.length; i++) {
        const curr = allRes.rows[i];
        const prev = i > 0 ? allRes.rows[i - 1] : {};
        const currDateStr = curr.entry_date.toISOString().split('T')[0];

        // Only keep days in the current FY
        if (currDateStr >= fyStartDate) {
            const dGenMu = (delta(curr.gen_main_meter, prev.gen_main_meter) * MF_GEN) / 1000;
            const lineDelta = (exp, imp, pExp, pImp) => delta(exp, pExp) - delta(imp, pImp);

            let netExpRaw = lineDelta(curr.peram_exp_main, curr.peram_imp_main, prev.peram_exp_main, prev.peram_imp_main) +
                lineDelta(curr.deviak_exp_main, curr.deviak_imp_main, prev.deviak_exp_main, prev.deviak_imp_main) +
                lineDelta(curr.cuddal_exp_main, curr.cuddal_imp_main, prev.cuddal_exp_main, prev.cuddal_imp_main) +
                lineDelta(curr.nlc2_exp_main, curr.nlc2_imp_main, prev.nlc2_exp_main, prev.nlc2_imp_main);

            let dExpMu = 0;
            if (netExpRaw > 0) {
                dExpMu = (netExpRaw * MF_EXP) / 1000;
            } else {
                // Fallback to the direct net_export field (which is a daily MWh total)
                dExpMu = N(curr.net_export) / 1000;
            }

            const dImpMu = N(curr.net_import_sy) / 1000; // As per Row 31 in 24cal which is E43 in OpsInput

            calculatedDays.push({
                ...curr,
                dGenMu,
                dExpMu,
                dImpMu,
                dAuxMu: Math.max(0, dGenMu - dExpMu + dImpMu),
                dScheduleMu: N(curr.schedule_gen_mldc) / 1000,
                dDeclaredMu: N(curr.declared_capacity_mwhr) / 1000,
                dDeemedMu: N(curr.deemed_gen_mwhr) / 1000,
                dHfoConsMt: (delta(curr.hfo_supply_int_rdg, prev.hfo_supply_int_rdg) - delta(curr.hfo_return_int_rdg, prev.hfo_return_int_rdg)) * 0.945 / 1000,
                dLigniteConsMt: N(curr.lignite_receipt_taqa_wb), // TBD: Check refined logic
                isTarget: currDateStr === targetDate
            });
        }
    }

    const r = calculatedDays[calculatedDays.length - 1]; // Target Day
    const mtdRows = calculatedDays.filter(d => d.entry_date.getMonth() === date.getMonth() && d.entry_date.getFullYear() === date.getFullYear());
    const ytdRows = calculatedDays;

    const sum = (rows, field) => rows.reduce((acc, row) => acc + (row[field] || 0), 0);
    const avg = (rows, field) => rows.length ? sum(rows, field) / rows.length : 0;
    const pct = (num, den) => (den != null && Number(den) > 0) ? (Number(num) / Number(den)) : 0;

    // ── Row Definitions ──────────────────────────────────────────────────────────

    const genRows = [
        { sn: "1", particulars: "Rated Capacity", uom: "MU", daily: DP_MU, mtd: DP_MU * mtdRows.length, ytd: DP_MU * ytdRows.length },
        { sn: "2", particulars: "Declared Capacity", uom: "MU", daily: r.dDeclaredMu, mtd: sum(mtdRows, 'dDeclaredMu'), ytd: sum(ytdRows, 'dDeclaredMu') },
        { sn: "3", particulars: "Dispatch Demand", uom: "MU", daily: N(r.dispatch_demand_mwhr) / 1000, mtd: sum(mtdRows, 'dispatch_demand_mwhr') / 1000, ytd: sum(ytdRows, 'dispatch_demand_mwhr') / 1000 },
        { sn: "4", particulars: "Schedule Generation", uom: "MU", daily: r.dScheduleMu, mtd: sum(mtdRows, 'dScheduleMu'), ytd: sum(ytdRows, 'dScheduleMu') },
        { sn: "5", particulars: "Gross Generation", uom: "MU", daily: r.dGenMu, mtd: sum(mtdRows, 'dGenMu'), ytd: sum(ytdRows, 'dGenMu') },
        { sn: "6", particulars: "Deemed Generation", uom: "MU", daily: r.dDeemedMu, mtd: sum(mtdRows, 'dDeemedMu'), ytd: sum(ytdRows, 'dDeemedMu') },
        { sn: "7", particulars: "Auxiliary Consumption", uom: "MU", daily: r.dAuxMu, mtd: sum(mtdRows, 'dAuxMu'), ytd: sum(ytdRows, 'dAuxMu') },
        { sn: "8", particulars: "Net Import", uom: "MU", daily: r.dImpMu, mtd: sum(mtdRows, 'dImpMu'), ytd: sum(ytdRows, 'dImpMu') },
        { sn: "9", particulars: "Net Export", uom: "MU", daily: r.dExpMu, mtd: sum(mtdRows, 'dExpMu'), ytd: sum(ytdRows, 'dExpMu') },
    ];

    const kpiRows = [
        {
            sn: "10", particulars: "Auxiliary Power Consumption (APC)", uom: "%",
            daily: pct(r.dAuxMu, r.dGenMu),
            mtd: pct(sum(mtdRows, 'dAuxMu'), sum(mtdRows, 'dGenMu')),
            ytd: pct(sum(ytdRows, 'dAuxMu'), sum(ytdRows, 'dGenMu'))
        },
        {
            sn: "11", particulars: "Plant Availability Factor (PAF)", uom: "%",
            daily: pct(r.dDeclaredMu, DP_MU),
            mtd: pct(sum(mtdRows, 'dDeclaredMu'), DP_MU * mtdRows.length),
            ytd: pct(sum(ytdRows, 'dDeclaredMu'), DP_MU * ytdRows.length)
        },
        {
            sn: "12", particulars: "Plant Load Factor (PLF)", uom: "%",
            daily: pct(r.dGenMu, DP_MU),
            mtd: pct(sum(mtdRows, 'dGenMu'), DP_MU * mtdRows.length),
            ytd: pct(sum(ytdRows, 'dGenMu'), DP_MU * ytdRows.length)
        },
        {
            sn: "13", particulars: "Forced Outage Rate (FOR)", uom: "%",
            daily: pct(N(r.forced_outage_hrs), (N(r.total_hours) - N(r.scheduled_outage_hrs))),
            mtd: pct(sum(mtdRows, 'forced_outage_hrs'), (sum(mtdRows, 'total_hours') - sum(mtdRows, 'scheduled_outage_hrs'))),
            ytd: pct(sum(ytdRows, 'forced_outage_hrs'), (sum(ytdRows, 'total_hours') - sum(ytdRows, 'scheduled_outage_hrs')))
        },
        { sn: "14", particulars: "Scheduled Outage Factor (SOF)", uom: "%", daily: pct(N(r.scheduled_outage_hrs), N(r.total_hours)), mtd: pct(sum(mtdRows, 'scheduled_outage_hrs'), sum(mtdRows, 'total_hours')), ytd: pct(sum(ytdRows, 'scheduled_outage_hrs'), sum(ytdRows, 'total_hours')) },
        { sn: "15", particulars: "Dispatch Demand (DD)", uom: "%", daily: pct(r.dScheduleMu, r.dDeclaredMu), mtd: pct(sum(mtdRows, 'dScheduleMu'), sum(mtdRows, 'dDeclaredMu')), ytd: pct(sum(ytdRows, 'dScheduleMu'), sum(ytdRows, 'dDeclaredMu')) },
        { sn: "16", particulars: "Ex Bus Schedule Generation (SG)", uom: "%", daily: 1, mtd: 1, ytd: 1 },
    ];

    const hourRows = [
        { sn: "17", particulars: "Unit trip", uom: "No's", daily: N(r.no_unit_trips), mtd: sum(mtdRows, 'no_unit_trips'), ytd: sum(ytdRows, 'no_unit_trips') },
        { sn: "18", particulars: "Unit Shutdown", uom: "No's", daily: N(r.no_unit_shutdown), mtd: sum(mtdRows, 'no_unit_shutdown'), ytd: sum(ytdRows, 'no_unit_shutdown') },
        { sn: "19", particulars: "Unit On Grid", uom: "hrs", daily: N(r.dispatch_duration), mtd: sum(mtdRows, 'dispatch_duration'), ytd: sum(ytdRows, 'dispatch_duration') },
        { sn: "20", particulars: "Load Backdown - 170MW", uom: "hrs", daily: N(r.load_backdown_duration), mtd: sum(mtdRows, 'load_backdown_duration'), ytd: sum(ytdRows, 'load_backdown_duration') },
        { sn: "21", particulars: "Unit on standby - RSD", uom: "hrs", daily: N(r.unit_standby_hrs), mtd: sum(mtdRows, 'unit_standby_hrs'), ytd: sum(ytdRows, 'unit_standby_hrs') },
        { sn: "22", particulars: "Scheduled Outage", uom: "hrs", daily: N(r.scheduled_outage_hrs), mtd: sum(mtdRows, 'scheduled_outage_hrs'), ytd: sum(ytdRows, 'scheduled_outage_hrs') },
        { sn: "23", particulars: "Forced Outage", uom: "hrs", daily: N(r.forced_outage_hrs), mtd: sum(mtdRows, 'forced_outage_hrs'), ytd: sum(ytdRows, 'forced_outage_hrs') },
        { sn: "24", particulars: "De-rated Equivalent Outage", uom: "hrs", daily: N(r.derated_outage_hrs), mtd: sum(mtdRows, 'derated_outage_hrs'), ytd: sum(ytdRows, 'derated_outage_hrs') },
    ];

    const fuelRows = [
        { sn: "25", particulars: "HFO Consumption", uom: "MT", daily: r.dHfoConsMt, mtd: sum(mtdRows, 'dHfoConsMt'), ytd: sum(ytdRows, 'dHfoConsMt') },
        { sn: "26", particulars: "HFO Receipt", uom: "MT", daily: N(r.hfo_receipt_mt), mtd: sum(mtdRows, 'hfo_receipt_mt'), ytd: sum(ytdRows, 'hfo_receipt_mt') },
        { sn: "27", particulars: "HFO Stock", uom: "MT", daily: N(r.hfo_t10_lvl_calc) + N(r.hfo_t20_lvl_calc), mtd: null, ytd: null },
        { sn: "28", particulars: "Sp Oil Consumption", uom: "ml/kWh", daily: (r.dHfoConsMt / r.dGenMu) * 1000 || 0, mtd: (sum(mtdRows, 'dHfoConsMt') / sum(mtdRows, 'dGenMu')) * 1000 || 0, ytd: (sum(ytdRows, 'dHfoConsMt') / sum(ytdRows, 'dGenMu')) * 1000 || 0 },
        { sn: "29", particulars: "Lignite Consumption", uom: "MT", daily: r.dLigniteConsMt, mtd: sum(mtdRows, 'dLigniteConsMt'), ytd: sum(ytdRows, 'dLigniteConsMt') },
        { sn: "30", particulars: "Lignite Receipt", uom: "MT", daily: N(r.lignite_receipt_taqa_wb), mtd: sum(mtdRows, 'lignite_receipt_taqa_wb'), ytd: sum(ytdRows, 'lignite_receipt_taqa_wb') },
        { sn: "31", particulars: "Lignite Stock at Plant", uom: "MT", daily: N(r.lignite_vadallur_silo), mtd: null, ytd: null },
        { sn: "32", particulars: "Sp Lignite Consumption", uom: "kg/kWh", daily: pct(r.dLigniteConsMt, r.dGenMu * 1000), mtd: pct(sum(mtdRows, 'dLigniteConsMt'), sum(mtdRows, 'dGenMu') * 1000), ytd: pct(sum(ytdRows, 'dLigniteConsMt'), sum(ytdRows, 'dGenMu') * 1000) },
        { sn: "33", particulars: "Lignite Lifted from NLC", uom: "MT", daily: N(r.lignite_lifted_nlcil_wb), mtd: sum(mtdRows, 'lignite_lifted_nlcil_wb'), ytd: sum(ytdRows, 'lignite_lifted_nlcil_wb') },
        { sn: "34", particulars: "HSD Consumption", uom: "kl", daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl), mtd: sum(mtdRows, 'hsd_t30_receipt_kl') + sum(mtdRows, 'hsd_t40_receipt_kl'), ytd: sum(ytdRows, 'hsd_t30_receipt_kl') + sum(ytdRows, 'hsd_t40_receipt_kl') },
        { sn: "35", particulars: "HSD Receipt", uom: "kl", daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl), mtd: sum(mtdRows, 'hsd_t30_receipt_kl') + sum(mtdRows, 'hsd_t40_receipt_kl'), ytd: sum(ytdRows, 'hsd_t30_receipt_kl') + sum(ytdRows, 'hsd_t40_receipt_kl') },
        { sn: "36", particulars: "HSD Stock", uom: "kl", daily: N(r.hsd_t30_lvl) + N(r.hsd_t40_lvl), mtd: null, ytd: null },
    ];

    const hrRows = [
        { sn: "37", particulars: "Fuel master Avg at FLC", uom: "%", daily: N(r.fuel_master_250mw), mtd: avg(mtdRows, 'fuel_master_250mw'), ytd: avg(ytdRows, 'fuel_master_250mw') },
        { sn: "38", particulars: "GCV (As Fired)", uom: "kcal/kg", daily: N(r.chem_gcv_nlcil), mtd: avg(mtdRows, 'chem_gcv_nlcil'), ytd: avg(ytdRows, 'chem_gcv_nlcil') },
        {
            sn: "39", particulars: "GHR (As Fired)", uom: "kcal/kWh",
            daily: (N(r.lignite_receipt_taqa_wb) * N(r.chem_gcv_nlcil)) / (r.dGenMu * 1000) || 0,
            mtd: (sum(mtdRows, 'lignite_receipt_taqa_wb') * avg(mtdRows, 'chem_gcv_nlcil')) / (sum(mtdRows, 'dGenMu') * 1000) || 0,
            ytd: (sum(ytdRows, 'lignite_receipt_taqa_wb') * avg(ytdRows, 'chem_gcv_nlcil')) / (sum(ytdRows, 'dGenMu') * 1000) || 0
        },
        { sn: "40", particulars: "Lignite Consumption (Normative)", uom: "MT", daily: 0, mtd: 0, ytd: 0 },
        { sn: "41", particulars: "Lignite Normative (-) loss", uom: "MT", daily: 0, mtd: 0, ytd: 0 },
        { sn: "42", particulars: "LOI in Bottom ash", uom: "%", daily: N(r.chem_ubc_bottom_ash), mtd: avg(mtdRows, 'chem_ubc_bottom_ash'), ytd: avg(ytdRows, 'chem_ubc_bottom_ash') },
        { sn: "43", particulars: "LOI in Fly ash", uom: "%", daily: N(r.chem_ubc_fly_ash), mtd: avg(mtdRows, 'chem_ubc_fly_ash'), ytd: avg(ytdRows, 'chem_ubc_fly_ash') },
    ];

    const waterRows = [
        { sn: "44", particulars: "DM water Production", uom: "M3", daily: N(r.dm_water_prod_m3), mtd: sum(mtdRows, 'dm_water_prod_m3'), ytd: sum(ytdRows, 'dm_water_prod_m3') },
        { sn: "45", particulars: "DM water Consumption for main boiler", uom: "M3", daily: N(r.dm_to_condenser), mtd: sum(mtdRows, 'dm_to_condenser'), ytd: sum(ytdRows, 'dm_to_condenser') },
        { sn: "46", particulars: "DM Water Consumption for total plant", uom: "M3", daily: N(r.dm_to_condenser) + N(r.cst_to_main_unit), mtd: sum(mtdRows, 'dm_to_condenser') + sum(mtdRows, 'cst_to_main_unit'), ytd: sum(ytdRows, 'dm_to_condenser') + sum(ytdRows, 'cst_to_main_unit') },
        { sn: "47", particulars: "Service Water Consumption", uom: "M3", daily: N(r.service_water_flow), mtd: sum(mtdRows, 'service_water_flow'), ytd: sum(ytdRows, 'service_water_flow') },
        { sn: "48", particulars: "Seal water Consumption", uom: "M3", daily: N(r.seal_water_supply), mtd: sum(mtdRows, 'seal_water_supply'), ytd: sum(ytdRows, 'seal_water_supply') },
        { sn: "49", particulars: "Potable Water Consumption", uom: "M3", daily: N(r.potable_tank_makeup), mtd: sum(mtdRows, 'potable_tank_makeup'), ytd: sum(ytdRows, 'potable_tank_makeup') },
        { sn: "50", particulars: "Bore well water consumption", uom: "M3", daily: N(r.borewell_to_reservoir) + N(r.borewell_to_cw_forebay), mtd: sum(mtdRows, 'borewell_to_reservoir') + sum(mtdRows, 'borewell_to_cw_forebay'), ytd: sum(ytdRows, 'borewell_to_reservoir') + sum(ytdRows, 'borewell_to_cw_forebay') },
        { sn: "51", particulars: "Ash water reuse to CW forebay", uom: "M3", daily: N(r.ash_pond_overflow), mtd: sum(mtdRows, 'ash_pond_overflow'), ytd: sum(ytdRows, 'ash_pond_overflow') },
        { sn: "52", particulars: "Cooling water blow down", uom: "M3", daily: N(r.cw_blowdown), mtd: sum(mtdRows, 'cw_blowdown'), ytd: sum(ytdRows, 'cw_blowdown') },
        { sn: "53", particulars: "Cooling water blow down rate", uom: "M3/hr", daily: N(r.cw_blowdown) / 24, mtd: sum(mtdRows, 'cw_blowdown') / (mtdRows.length * 24), ytd: sum(ytdRows, 'cw_blowdown') / (ytdRows.length * 24) },
        { sn: "54", particulars: "Total Water consumption", uom: "M3/MWh", daily: pct(N(r.service_water_flow), r.dGenMu * 1000), mtd: pct(sum(mtdRows, 'service_water_flow'), sum(mtdRows, 'dGenMu') * 1000), ytd: pct(sum(ytdRows, 'service_water_flow'), sum(ytdRows, 'dGenMu') * 1000) },
    ];

    const ashGenManual = (N(r.lignite_receipt_taqa_wb) * N(r.chem_ash_pct)) / 100;
    const ashRows = [
        { sn: "59", particulars: "Ash Generation", uom: "MT", daily: ashGenManual, mtd: sum(mtdRows, 'lignite_receipt_taqa_wb') * avg(mtdRows, 'chem_ash_pct') / 100, ytd: sum(ytdRows, 'lignite_receipt_taqa_wb') * avg(ytdRows, 'chem_ash_pct') / 100 },
        { sn: "61", particulars: "Fly Ash Quantity to cement plant", uom: "MT", daily: N(r.chem_ash_sales_mt), mtd: sum(mtdRows, 'chem_ash_sales_mt'), ytd: sum(ytdRows, 'chem_ash_sales_mt') },
    ];

    const envRows = [
        { sn: "76", particulars: "Grid Frequency (Max / Min)", uom: "Hz", daily: `${N(r.grid_freq_max)} / ${N(r.grid_freq_min)}`, mtd: null, ytd: null },
        { sn: "70", particulars: "DSM Charges (Lac)", uom: "Lac", daily: N(r.dsm_charges) / 100000, mtd: sum(mtdRows, 'dsm_charges') / 100000, ytd: sum(ytdRows, 'dsm_charges') / 100000 },
        { sn: "74", particulars: "Remarks - if any", uom: "text", daily: r.remarks || '—', mtd: null, ytd: null },
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
