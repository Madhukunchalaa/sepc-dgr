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

    // Timezone-safe date formatter — avoids UTC-shift on date-only pg values at midnight IST
    const safeDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string') return d.split('T')[0];
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const lastRow = allRes.rows[allRes.rows.length - 1];
    if (!allRes.rows.length || safeDate(lastRow?.entry_date) !== targetDate) {
        const err = new Error('No TAQA data for this date. Enter Ops Input first.');
        err.code = 'TAQA_NO_DATA';
        throw err;
    }

    // 2. Constants & Multipliers — from Excel '24 cal' sheet analysis
    //    CAPACITY_MW = 250 MW rated capacity
    //    DP_MU       = 250 × 24 / 1000 = 6.0 MU  (rated capacity per day)
    //    MF_GEN      = 18 × 12000 / 110 ≈ 1963.636  (generator main/check meter multiplier)
    //    MF_EXP      = (230/110) × 500  ≈ 1045.454  (switchyard line meter multiplier)
    const CAPACITY_MW = 250;
    const DP_MU = (CAPACITY_MW * 24) / 1000;   // 6.0 MU
    const MF_GEN = (18 * 12000) / 110;           // ~1963.636
    const MF_EXP = (230 / 110) * 500;            // ~1045.454

    const N = (val) => Number(val || 0);

    // delta: cumulative meter reading difference, guarded against missing/zero prev readings
    // Mirrors Excel: =IF(OR(prev<=0, curr<=0), 0, curr - prev)
    const delta = (currVal, prevVal) => {
        const c = N(currVal);
        const p = N(prevVal);
        if (p <= 0 || c <= 0) return 0;
        return Math.max(0, c - p);
    };

    // 3. Process All Days in Window to get Daily Values
    //
    //  Formula references map to Excel '24 cal' rows as follows:
    //
    //  Row 32  Gross Generation (main meter)
    //          = (gen_main_meter_curr - gen_main_meter_prev) × MF_GEN   [Ops row 47]
    //
    //  Row 24  Net Export (switchyard main meters, 4 lines)
    //          = Σ[(exp_main delta) - (imp_main delta)] × MF_EXP         [Ops rows 27-40]
    //          Fallback: net_export field (daily MWh total)               [Ops row 45]
    //
    //  Row 31  Net Import (partly on grid)                                [Ops row 43]
    //
    //  Row 34  Aux Consumption (export-based APC)
    //          = IF(unit shutdown, Net Import MWhr, Gross Gen MWhr - Net Export MWhr)
    //
    //  Row 37  Declared Capacity                                          [Ops row 55]
    //          = declared_capacity_mwhr  (= 250 MW × available hours)
    //          Full day = 6000 MWhr = 6.0 MU; partial day e.g. 10.73 hrs = 2683.33 MWhr
    //
    //  Row 38  Deemed Generation                                          [Ops row 56]
    //          = deemed_gen_mwhr  (grid-curtailed energy, directly entered)
    //
    //  Row 39  Dispatch Demand                                            [Ops row 57]
    //          = dispatch_demand_mwhr  (= Declared Capacity - Deemed Generation)
    //
    //  Row 28  Schedule Generation from MLDC                             [Ops row 46]
    //          = schedule_gen_mldc  (daily MWh total, direct entry)

    const calculatedDays = [];
    for (let i = 0; i < allRes.rows.length; i++) {
        const curr = allRes.rows[i];
        const prev = i > 0 ? allRes.rows[i - 1] : {};
        const currDateStr = safeDate(curr.entry_date);

        // Only keep days in the current FY
        if (currDateStr >= fyStartDate) {

            // ── Gross Generation (24cal row 32) ─────────────────────────────────
            // = delta(gen_main_meter) × MF_GEN  [MWhr]
            const _dGenUnits = delta(curr.gen_main_meter, prev.gen_main_meter);
            const dGenMwhr = _dGenUnits * MF_GEN;
            const dGenMu = dGenMwhr / 1000;

            // ── Net Export (24cal row 24) ────────────────────────────────────────
            // Sum of 4 switchyard line deltas × MF_EXP
            const lineDelta = (exp, imp, pExp, pImp) =>
                delta(exp, pExp) - delta(imp, pImp);

            const netExpRawUnits = (
                lineDelta(curr.peram_exp_main, curr.peram_imp_main, prev.peram_exp_main, prev.peram_imp_main) +
                lineDelta(curr.deviak_exp_main, curr.deviak_imp_main, prev.deviak_exp_main, prev.deviak_imp_main) +
                lineDelta(curr.cuddal_exp_main, curr.cuddal_imp_main, prev.cuddal_exp_main, prev.cuddal_imp_main) +
                lineDelta(curr.nlc2_exp_main, curr.nlc2_imp_main, prev.nlc2_exp_main, prev.nlc2_imp_main)
            );

            // Fallback to direct net_export field when switchyard meters unavailable
            const dExpMwhr = netExpRawUnits > 0
                ? netExpRawUnits * MF_EXP
                : N(curr.net_export);
            const dExpMu = dExpMwhr / 1000;

            // ── Net Import (24cal row 31 → Ops row 43) ──────────────────────────
            const dImpMwhr = N(curr.net_import_sy);
            const dImpMu = dImpMwhr / 1000;

            // ── Aux Consumption (24cal row 34 — export-based APC) ───────────────
            // = IF(shutdown, Net Import MWhr, Gross Gen MWhr - Net Export MWhr)
            const unitShutdown = N(curr.no_unit_shutdown) > 0 && dGenMwhr === 0;
            const dAuxMwhr = unitShutdown
                ? dImpMwhr
                : Math.max(0, dGenMwhr - dExpMwhr);
            const dAuxMu = dAuxMwhr / 1000;

            // ── Declared Capacity (24cal row 37 → Ops row 55) ───────────────────
            // Directly entered: 250 MW × available hours
            const dDeclaredMwhr = N(curr.declared_capacity_mwhr);
            const dDeclaredMu = dDeclaredMwhr / 1000;

            // ── Deemed Generation (24cal row 38 → Ops row 56) ───────────────────
            // Grid-curtailed energy — plant available but grid didn't draw it
            const dDeemedMwhr = N(curr.deemed_gen_mwhr);
            const dDeemedMu = dDeemedMwhr / 1000;

            // ── Dispatch Demand (24cal row 39 → Ops row 57) ─────────────────────
            // = Declared Capacity - Deemed Generation  (directly entered)
            const dDispatchMwhr = N(curr.dispatch_demand_mwhr);
            const dDispatchMu = dDispatchMwhr / 1000;

            // ── Schedule Generation from MLDC (24cal row 28 → Ops row 46) ───────
            const dScheduleMwhr = N(curr.schedule_gen_mldc);
            const dScheduleMu = dScheduleMwhr / 1000;

            // ── HFO Consumption ──────────────────────────────────────────────────
            // = (supply_integrator_delta - return_integrator_delta) × 0.945 / 1000 [MT]
            const _hfoDeltaSupply = delta(curr.hfo_supply_int_rdg, prev.hfo_supply_int_rdg);
            const _hfoDeltaReturn = delta(curr.hfo_return_int_rdg, prev.hfo_return_int_rdg);
            const dHfoConsMt = (_hfoDeltaSupply - _hfoDeltaReturn) * 0.945 / 1000;

            calculatedDays.push({
                ...curr,
                // Computed daily values
                dGenMu,
                dExpMu,
                dImpMu,
                dAuxMu,
                dDeclaredMu,
                dDeemedMu,
                dDispatchMu,
                dScheduleMu,
                dHfoConsMt,
                dLigniteConsMt: N(curr.lignite_receipt_taqa_wb),
                // Raw deltas preserved for audit section
                _dGenUnits,
                _hfoDeltaSupply,
                _hfoDeltaReturn,
                _prevRow: prev,
                isTarget: currDateStr === targetDate,
            });
        }
    }

    const r = calculatedDays[calculatedDays.length - 1]; // Target day
    const mtdRows = calculatedDays.filter(d => safeDate(d.entry_date).slice(0, 7) === targetDate.slice(0, 7));
    const ytdRows = calculatedDays;

    const sum = (rows, field) => rows.reduce((acc, row) => acc + (N(row[field]) || 0), 0);
    const avg = (rows, field) => rows.length ? sum(rows, field) / rows.length : 0;
    const pct = (num, den) => (den != null && Number(den) > 0) ? (Number(num) / Number(den)) : 0;

    // ── Row Definitions ──────────────────────────────────────────────────────────
    //
    //  SN 1  Rated Capacity    = 6.0 MU fixed  (250 MW × 24h / 1000)
    //  SN 2  Declared Capacity = declared_capacity_mwhr / 1000          [Ops row 55]
    //  SN 3  Dispatch Demand   = dispatch_demand_mwhr / 1000             [Ops row 57]
    //  SN 4  Schedule Gen      = schedule_gen_mldc / 1000                [Ops row 46]
    //  SN 5  Gross Generation  = delta(gen_main_meter) × MF_GEN / 1000  [Ops row 47]
    //  SN 6  Deemed Generation = deemed_gen_mwhr / 1000                  [Ops row 56]
    //  SN 7  Aux Consumption   = (Gross MWhr - Export MWhr) / 1000      [24cal row 34]
    //  SN 8  Net Import        = net_import_sy / 1000                    [Ops row 43]
    //  SN 9  Net Export        = Σ line deltas × MF_EXP / 1000          [24cal row 24]

    const genRows = [
        {
            sn: "1", particulars: "Rated Capacity", uom: "MU",
            daily: DP_MU,
            mtd: DP_MU * mtdRows.length,
            ytd: DP_MU * ytdRows.length,
        },
        {
            // SN 2: declared_capacity_mwhr (Ops row 55) / 1000
            // = 250 MW × available hours on that day
            sn: "2", particulars: "Declared Capacity", uom: "MU",
            daily: r.dDeclaredMu,
            mtd: sum(mtdRows, 'dDeclaredMu'),
            ytd: sum(ytdRows, 'dDeclaredMu'),
        },
        {
            // SN 3: dispatch_demand_mwhr (Ops row 57) / 1000
            // = Declared Capacity - Deemed Generation
            sn: "3", particulars: "Dispatch Demand", uom: "MU",
            daily: r.dDispatchMu,
            mtd: sum(mtdRows, 'dDispatchMu'),
            ytd: sum(ytdRows, 'dDispatchMu'),
        },
        {
            // SN 4: schedule_gen_mldc (Ops row 46) / 1000
            sn: "4", particulars: "Schedule Generation", uom: "MU",
            daily: r.dScheduleMu,
            mtd: sum(mtdRows, 'dScheduleMu'),
            ytd: sum(ytdRows, 'dScheduleMu'),
        },
        {
            // SN 5: delta(gen_main_meter) × MF_GEN / 1000  (24cal row 32)
            sn: "5", particulars: "Gross Generation", uom: "MU",
            daily: r.dGenMu,
            mtd: sum(mtdRows, 'dGenMu'),
            ytd: sum(ytdRows, 'dGenMu'),
        },
        {
            // SN 6: deemed_gen_mwhr (Ops row 56) / 1000
            sn: "6", particulars: "Deemed Generation", uom: "MU",
            daily: r.dDeemedMu,
            mtd: sum(mtdRows, 'dDeemedMu'),
            ytd: sum(ytdRows, 'dDeemedMu'),
        },
        {
            // SN 7: (Gross Gen MWhr - Net Export MWhr) / 1000  (24cal row 34)
            sn: "7", particulars: "Auxiliary Consumption", uom: "MU",
            daily: r.dAuxMu,
            mtd: sum(mtdRows, 'dAuxMu'),
            ytd: sum(ytdRows, 'dAuxMu'),
        },
        {
            // SN 8: net_import_sy (Ops row 43) / 1000  (24cal row 31)
            sn: "8", particulars: "Net Import", uom: "MU",
            daily: r.dImpMu,
            mtd: sum(mtdRows, 'dImpMu'),
            ytd: sum(ytdRows, 'dImpMu'),
        },
        {
            // SN 9: Σ switchyard line deltas × MF_EXP / 1000  (24cal row 24)
            sn: "9", particulars: "Net Export", uom: "MU",
            daily: r.dExpMu,
            mtd: sum(mtdRows, 'dExpMu'),
            ytd: sum(ytdRows, 'dExpMu'),
        },
    ];

    //  SN 10  APC % = Aux Consumption / Gross Generation
    //  SN 11  PAF % = Declared Capacity / Rated Capacity (6.0 MU)
    //  SN 12  PLF % = Gross Generation / Rated Capacity (6.0 MU)
    //  SN 13  FOR % = Forced Outage hrs / (Total hrs - Scheduled Outage hrs)
    //  SN 14  SOF % = Scheduled Outage hrs / Total hrs
    //  SN 15  DD %  = Schedule Generation / Declared Capacity

    const kpiRows = [
        {
            sn: "10", particulars: "Auxiliary Power Consumption (APC)", uom: "%",
            daily: pct(r.dAuxMu, r.dGenMu),
            mtd: pct(sum(mtdRows, 'dAuxMu'), sum(mtdRows, 'dGenMu')),
            ytd: pct(sum(ytdRows, 'dAuxMu'), sum(ytdRows, 'dGenMu')),
        },
        {
            // PAF = Declared Capacity MU / Rated Capacity MU (6.0)
            sn: "11", particulars: "Plant Availability Factor (PAF)", uom: "%",
            daily: pct(r.dDeclaredMu, DP_MU),
            mtd: pct(sum(mtdRows, 'dDeclaredMu'), DP_MU * mtdRows.length),
            ytd: pct(sum(ytdRows, 'dDeclaredMu'), DP_MU * ytdRows.length),
        },
        {
            // PLF = Gross Generation MU / Rated Capacity MU (6.0)
            sn: "12", particulars: "Plant Load Factor (PLF)", uom: "%",
            daily: pct(r.dGenMu, DP_MU),
            mtd: pct(sum(mtdRows, 'dGenMu'), DP_MU * mtdRows.length),
            ytd: pct(sum(ytdRows, 'dGenMu'), DP_MU * ytdRows.length),
        },
        {
            // FOR = Forced Outage hrs / (Total hrs - Scheduled Outage hrs)
            sn: "13", particulars: "Forced Outage Rate (FOR)", uom: "%",
            daily: pct(N(r.forced_outage_hrs), N(r.total_hours) - N(r.scheduled_outage_hrs)),
            mtd: pct(sum(mtdRows, 'forced_outage_hrs'), sum(mtdRows, 'total_hours') - sum(mtdRows, 'scheduled_outage_hrs')),
            ytd: pct(sum(ytdRows, 'forced_outage_hrs'), sum(ytdRows, 'total_hours') - sum(ytdRows, 'scheduled_outage_hrs')),
        },
        {
            // SOF = Scheduled Outage hrs / Total hrs
            sn: "14", particulars: "Scheduled Outage Factor (SOF)", uom: "%",
            daily: pct(N(r.scheduled_outage_hrs), N(r.total_hours)),
            mtd: pct(sum(mtdRows, 'scheduled_outage_hrs'), sum(mtdRows, 'total_hours')),
            ytd: pct(sum(ytdRows, 'scheduled_outage_hrs'), sum(ytdRows, 'total_hours')),
        },
        {
            // DD% = Schedule Generation / Declared Capacity
            sn: "15", particulars: "Dispatch Demand (DD)", uom: "%",
            daily: pct(r.dScheduleMu, r.dDeclaredMu),
            mtd: pct(sum(mtdRows, 'dScheduleMu'), sum(mtdRows, 'dDeclaredMu')),
            ytd: pct(sum(ytdRows, 'dScheduleMu'), sum(ytdRows, 'dDeclaredMu')),
        },
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
        { sn: "28", particulars: "Sp Oil Consumption", uom: "ml/kWh", daily: r.dGenMu > 0 ? (r.dHfoConsMt / r.dGenMu) * 1000 : 0, mtd: sum(mtdRows, 'dGenMu') > 0 ? (sum(mtdRows, 'dHfoConsMt') / sum(mtdRows, 'dGenMu')) * 1000 : 0, ytd: sum(ytdRows, 'dGenMu') > 0 ? (sum(ytdRows, 'dHfoConsMt') / sum(ytdRows, 'dGenMu')) * 1000 : 0 },
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
        { sn: "39", particulars: "GHR (As Fired)", uom: "kcal/kWh", daily: r.dGenMu > 0 ? (N(r.lignite_receipt_taqa_wb) * N(r.chem_gcv_nlcil)) / (r.dGenMu * 1000) : 0, mtd: sum(mtdRows, 'dGenMu') > 0 ? (sum(mtdRows, 'lignite_receipt_taqa_wb') * avg(mtdRows, 'chem_gcv_nlcil')) / (sum(mtdRows, 'dGenMu') * 1000) : 0, ytd: sum(ytdRows, 'dGenMu') > 0 ? (sum(ytdRows, 'lignite_receipt_taqa_wb') * avg(ytdRows, 'chem_gcv_nlcil')) / (sum(ytdRows, 'dGenMu') * 1000) : 0 },
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

    // Audit section — exposes raw deltas so values can be cross-checked against Excel '24 cal' manually
    const auditRows = [
        { sn: "C1", particulars: "Gen Main Meter Delta (Units)", uom: "Units", daily: r._dGenUnits || 0, mtd: null, ytd: null },
        { sn: "C2", particulars: "MF_GEN Multiplier (18×12000/110)", uom: "constant", daily: MF_GEN, mtd: null, ytd: null },
        { sn: "C3", particulars: "Gross Gen MWhr = C1 × C2", uom: "MWhr", daily: (r._dGenUnits || 0) * MF_GEN, mtd: sum(mtdRows, 'dGenMu') * 1000, ytd: sum(ytdRows, 'dGenMu') * 1000 },
        { sn: "C4", particulars: "Gross Gen MU = C3 / 1000", uom: "MU", daily: r.dGenMu, mtd: sum(mtdRows, 'dGenMu'), ytd: sum(ytdRows, 'dGenMu') },
        { sn: "C5", particulars: "Net Export MU  (switchyard lines × MF_EXP)", uom: "MU", daily: r.dExpMu, mtd: sum(mtdRows, 'dExpMu'), ytd: sum(ytdRows, 'dExpMu') },
        { sn: "C6", particulars: "Net Import MU  (net_import_sy / 1000)", uom: "MU", daily: r.dImpMu, mtd: sum(mtdRows, 'dImpMu'), ytd: sum(ytdRows, 'dImpMu') },
        { sn: "C7", particulars: "Aux MU = Gross − Export  (24cal row 34)", uom: "MU", daily: r.dAuxMu, mtd: sum(mtdRows, 'dAuxMu'), ytd: sum(ytdRows, 'dAuxMu') },
        { sn: "C8", particulars: "Declared Capacity MU  (Ops row 55 / 1000)", uom: "MU", daily: r.dDeclaredMu, mtd: sum(mtdRows, 'dDeclaredMu'), ytd: sum(ytdRows, 'dDeclaredMu') },
        { sn: "C9", particulars: "Deemed Gen MU  (Ops row 56 / 1000)", uom: "MU", daily: r.dDeemedMu, mtd: sum(mtdRows, 'dDeemedMu'), ytd: sum(ytdRows, 'dDeemedMu') },
        { sn: "C10", particulars: "Dispatch Demand MU  (Ops row 57 / 1000)", uom: "MU", daily: r.dDispatchMu, mtd: sum(mtdRows, 'dDispatchMu'), ytd: sum(ytdRows, 'dDispatchMu') },
        { sn: "C11", particulars: "HFO Supply Integrator Delta", uom: "L", daily: r._hfoDeltaSupply || 0, mtd: null, ytd: null },
        { sn: "C12", particulars: "HFO Return Integrator Delta", uom: "L", daily: r._hfoDeltaReturn || 0, mtd: null, ytd: null },
        { sn: "C13", particulars: "HFO Net Consumption MT = (C11−C12)×0.945/1000", uom: "MT", daily: r.dHfoConsMt, mtd: sum(mtdRows, 'dHfoConsMt'), ytd: sum(ytdRows, 'dHfoConsMt') },
        { sn: "C14", particulars: "PAF % = Declared MU / 6.0", uom: "%", daily: pct(r.dDeclaredMu, DP_MU), mtd: null, ytd: null },
        { sn: "C15", particulars: "PLF % = Gross Gen MU / 6.0", uom: "%", daily: pct(r.dGenMu, DP_MU), mtd: null, ytd: null },
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
            { title: "🧮 CALCULATION AUDIT (EXCEL 24 CAL)", rows: auditRows },
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