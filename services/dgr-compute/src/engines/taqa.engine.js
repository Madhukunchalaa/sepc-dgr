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

// ── Tank Calibration (TANK CALI sheet VLOOKUP tables) ─────────────────────────
// Stored as [storedLevel, liters] pairs. storedLevel has Excel FP accumulation
// (e.g. 576.2000000000625) which is intentionally kept to replicate VLOOKUP behavior:
// VLOOKUP finds the largest stored_level ≤ query_level (approximate match).
const _tankCali = require(path.join(__dirname, 'tank_cali.json'));
function strapLookup(table, level) {
    // Excel VLOOKUP approximate match: largest stored_level <= query
    if (!table || !table.length || !(level > 0)) return 0;
    let result = table[0][1];
    for (const [lv, vol] of table) {
        if (lv <= level) result = vol;
        else break;
    }
    return result;
}

async function assembleTaqaDGR(plant, targetDate) {
    console.log(`[taqa.engine] Assembling DGR for ${plant?.short_name} on ${targetDate}`);
    const plantId = plant.id;
    const date = new Date(targetDate);
    const fyStartDate = await getFYStartDate(plantId, targetDate);

    const fyDate = new Date(fyStartDate);
    const fyYear = fyDate.getFullYear();
    const fyLabel = `${fyYear}-${fyYear + 1}`;

    const daysSinceFyStart = Math.floor((date - fyDate) / (1000 * 60 * 60 * 24)) + 1;

    // Fetch from 2 days before FY start (needed for prevDataRow on first FY day + GCV lookback)
    const windowStart = new Date(fyStartDate);
    windowStart.setDate(windowStart.getDate() - 2);

    const [allRes, submissionStatus] = await Promise.all([
        query(
            `SELECT * FROM taqa_daily_input
             WHERE plant_id=$1 AND entry_date >= $2 AND entry_date <= $3
             ORDER BY entry_date ASC`,
            [plantId, windowStart.toISOString().split('T')[0], targetDate]
        ),
        getSubmissionStatus(plantId, targetDate)
    ]);

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

    // Constants
    const CAPACITY_MW = 250;
    const DP_MU = (CAPACITY_MW * 24) / 1000;   // 6.0 MU
    const MF_GEN = (18 * 12000) / 110;           // ~1963.636

    const N = (val) => Number(val || 0);
    const delta = (currVal, prevVal) => {
        const c = N(currVal);
        const p = N(prevVal);
        if (p <= 0 || c <= 0) return 0;
        return Math.max(0, c - p);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // DATA MODEL:
    // DB entry_date T stores T's Ops Input data (receipts, stock levels, etc.).
    // Integrator meters in T's entry = closing reading at end of T period.
    // Generation for T = delta(T.gen_meter, (T-1).gen_meter)
    //
    // For DGR date T:
    //   curr        = allRes.rows[i]    → T's DB entry (all direct reads)
    //   dataRow     = allRes.rows[i-1]  → T-1 entry (integrator base / opening stock)
    //   prevDataRow = allRes.rows[i-2]  → T-2 entry (GCV lookback E3-2)
    // ─────────────────────────────────────────────────────────────────────────
    const calculatedDays = [];
    for (let i = 0; i < allRes.rows.length; i++) {
        const curr = allRes.rows[i];
        const currDateStr = safeDate(curr.entry_date);

        if (currDateStr >= fyStartDate) {
            // DATA MODEL:
            // curr  = DB entry for report date T  → direct field reads (receipts, stocks, chemistry)
            // dataRow  = DB entry for T-1          → integrator delta "previous" value
            // prevDataRow = DB entry for T-2        → integrator delta "prev-prev" & GCV lookback
            const dataRow      = i > 0 ? allRes.rows[i - 1] : {};  // T-1 (prev integrator base)
            const prevDataRow  = i > 1 ? allRes.rows[i - 2] : {};  // T-2 (GCV lookback E3-2)

            // ── Gross Generation ──────────────────────────────────────────────
            // delta = curr meter (T closing) - dataRow meter (T-1 closing) = T period generation
            const dGrossGenMainMwh = delta(curr.gen_main_meter, dataRow.gen_main_meter) * MF_GEN;
            const dGrossGenMainMu  = dGrossGenMainMwh / 1000;

            // Excel DGR SN7 reads 24cal "Gross Gen - Check Meter" (HLOOKUP row off-by-1)
            const dGenMu = (delta(curr.gen_check_meter, dataRow.gen_check_meter) * MF_GEN) / 1000;

            // ── GT Bay / GT-APC ───────────────────────────────────────────────
            const dGtBayExpMwh = delta(curr.gt_bay_imp_rdg, dataRow.gt_bay_imp_rdg) * (230 / 110) * 1000;
            const dGtApcMu = Math.max(0, dGrossGenMainMu - dGtBayExpMwh / 1000);

            // ── Export / Import / Schedule ── direct reads from curr (T's Ops Input)
            const dExpMu      = N(curr.net_export) / 1000;
            const dImpMu      = N(curr.net_import_sy) / 1000;
            const dScheduleMu = N(curr.schedule_gen_mldc) / 1000;

            // ── HLOOKUP Off-by-1 field swaps for SN3 / SN6 ──────────────────
            const dDispatchMu = N(curr.deemed_gen_mwhr) / 1000;
            const dDeemedMu   = N(curr.declared_capacity_mwhr) / 1000;

            // SN2 "Declared Capacity" = GT-based APC
            const dDeclaredMu = dGtApcMu;
            // SN7 "Aux Consumption" = true station APC = Gross Generation − Net Export
            const dAuxMu = Math.max(0, dGrossGenMainMu - dExpMu);

            // ── HFO ──────────────────────────────────────────────────────────
            const _hfoDeltaSupply = delta(curr.hfo_supply_int_rdg, dataRow.hfo_supply_int_rdg);
            const _hfoDeltaReturn = delta(curr.hfo_return_int_rdg, dataRow.hfo_return_int_rdg);
            const dHfoConsMt = Math.max(0, (_hfoDeltaSupply - _hfoDeltaReturn) * 0.945 / 1000);

            // ── Lignite (belt weigher delta: curr closing meter - prev closing meter) ─
            const dBeltA = delta(curr.lignite_conv_1a_int_rdg, dataRow.lignite_conv_1a_int_rdg);
            const dBeltB = delta(curr.lignite_conv_1b_int_rdg, dataRow.lignite_conv_1b_int_rdg);
            const dLigniteConsMt = (dBeltA + dBeltB) > 0
                ? (dBeltA + dBeltB)
                : N(curr.lignite_receipt_taqa_wb);
            // Bunker-corrected consumption = Excel 24cal formula: -(bunker_curr - bunker_prev)*3.4 + 1A1B_consumption
            // This matches Excel 24cal R20: = -(E19-D19)*3.4 + E18
            // where E19=curr_bunker, D19=prev_bunker, E18=1A1B_consumption
            const dBunkerCorrLignite = Math.max(0,
                -(N(curr.lignite_bunker_lvl) - N(dataRow.lignite_bunker_lvl)) * 3.4
                + dLigniteConsMt);

            // ── Water (cumulative integrator deltas: curr - dataRow) ──────────
            const DM_TANK_FACTOR = (22 * 8.5 * 8.5) / (7 * 4); // ≈ 56.77 m²
            const dPotableMakeup = delta(curr.potable_tank_makeup, dataRow.potable_tank_makeup);
            const dRawWaterDm    = delta(curr.raw_water_to_dm, dataRow.raw_water_to_dm);
            const dCwBlowdown    = delta(curr.cw_blowdown, dataRow.cw_blowdown);
            const dServiceWater  = delta(curr.service_water_flow, dataRow.service_water_flow);
            const dSealWater     = delta(curr.seal_water_supply, dataRow.seal_water_supply);
            const dBoreholeTotal = delta(curr.borewell_to_reservoir, dataRow.borewell_to_reservoir)
                                 + delta(curr.borewell_to_cw_forebay, dataRow.borewell_to_cw_forebay);
            const dDmTankInventory = N(curr.dm_storage_tank_lvl) * DM_TANK_FACTOR;
            const dTotalWaterRate  = dGrossGenMainMwh > 0 ? N(curr.dm_water_prod_m3) / dGrossGenMainMwh : 0;
            // Ash totals = 1A1B belt weigher consumption × ash content %
            // Excel 24cal R125 formula: = R18 * ash_pct/100 (uses 1A1B consumption, not receipt)
            const dAshTotalMt  = (dLigniteConsMt * N(curr.chem_ash_pct)) / 100;
            const dFlyAshMt    = dAshTotalMt * 0.8;
            const dBottomAshMt = dAshTotalMt * 0.2;

            // ── GCV and GHR (corrected — uses current-date GCV, not T-2 lookback) ─
            // True GCV = chemistry input for this date
            const dGcvE3m2 = N(curr.chem_gcv_nlcil);
            // True GHR (24cal R49 formula): (GCV × bunker_corr_lignite_MT + HFO_MT × 10350) / GrossGenMWh
            const dGhrTrue = dGrossGenMainMwh > 0
                ? (N(curr.chem_gcv_nlcil) * dBunkerCorrLignite + dHfoConsMt * 10350) / dGrossGenMainMwh
                : 0;

            calculatedDays.push({
                ...curr,                 // spread T DB fields (receipts, stocks, chemistry, env)
                entry_date: currDateStr, // override date label
                dGrossGenMainMu,
                dGrossGenMainMwh,
                dGenMu,
                dGtApcMu,
                dGtBayExpMwh,
                dExpMu,
                dImpMu,
                dScheduleMu,
                dDispatchMu,
                dDeemedMu,
                dDeclaredMu,
                dAuxMu,
                dHfoConsMt,
                dLigniteConsMt,
                dBunkerCorrLignite,
                dPotableMakeup,
                dRawWaterDm,
                dCwBlowdown,
                dServiceWater,
                dSealWater,
                dBoreholeTotal,
                dDmTankInventory,
                dTotalWaterRate,
                dAshTotalMt,
                dFlyAshMt,
                dBottomAshMt,
                dGcvE3m2,
                dGhrTrue,
                isTarget: currDateStr === targetDate,
            });
        }
    }

    const r = calculatedDays[calculatedDays.length - 1]; // Target day
    console.log(`[taqa.engine] DEBUG: targetDate=${targetDate}, dGtApcMu=${r.dGtApcMu?.toFixed(4)}, dGrossGenMainMu=${r.dGrossGenMainMu?.toFixed(4)}`);

    const mtdRows = calculatedDays.filter(d => safeDate(d.entry_date).slice(0, 7) === targetDate.slice(0, 7));
    const ytdRows = calculatedDays;

    const sum = (rows, field) => rows.reduce((acc, row) => acc + (N(row[field]) || 0), 0);
    const avg = (rows, field) => rows.length ? sum(rows, field) / rows.length : 0;
    const pct = (num, den) => (den != null && Number(den) > 0) ? (Number(num) / Number(den)) : 0;

    // ── Generation Rows ───────────────────────────────────────────────────────
    // Row assignments mirror Excel DGR HLOOKUP actual readings (including off-by-1 bugs):
    //  SN1  Rated Capacity      = 6.0 MU fixed
    //  SN2  "Declared Cap"      = GT-based APC (24cal row one before Declared Cap)
    //  SN3  "Dispatch Demand"   = Deemed Gen MWh/1000 (HLOOKUP reads Deemed row)
    //  SN4  Schedule Generation = schedule_gen_mldc / 1000
    //  SN5  Gross Generation    = Main meter delta × MF_GEN / 1000
    //  SN6  "Deemed Generation" = Declared Cap MWh/1000 (HLOOKUP reads Declared row)
    //  SN7  "Aux Consumption"   = Check meter delta × MF_GEN / 1000 (≈ SN5 → APC≈100%)
    //  SN8  Net Import          = net_import_sy / 1000
    //  SN9  Net Export          = net_export / 1000

    const genRows = [
        {
            sn: "1", particulars: "Rated Capacity", uom: "MU",
            daily: DP_MU,
            mtd: DP_MU * mtdRows.length,
            ytd: DP_MU * ytdRows.length,
        },
        {
            sn: "2", particulars: "Declared Capacity", uom: "MU",
            daily: r.dDeclaredMu,
            mtd: sum(mtdRows, 'dDeclaredMu'),
            ytd: sum(ytdRows, 'dDeclaredMu'),
        },
        {
            sn: "3", particulars: "Dispatch Demand", uom: "MU",
            daily: r.dDispatchMu,
            mtd: sum(mtdRows, 'dDispatchMu'),
            ytd: sum(ytdRows, 'dDispatchMu'),
        },
        {
            sn: "4", particulars: "Schedule Generation", uom: "MU",
            daily: r.dScheduleMu,
            mtd: sum(mtdRows, 'dScheduleMu'),
            ytd: sum(ytdRows, 'dScheduleMu'),
        },
        {
            sn: "5", particulars: "Gross Generation", uom: "MU",
            daily: r.dGrossGenMainMu,
            mtd: sum(mtdRows, 'dGrossGenMainMu'),
            ytd: sum(ytdRows, 'dGrossGenMainMu'),
        },
        {
            sn: "6", particulars: "Deemed Generation", uom: "MU",
            daily: r.dDeemedMu,
            mtd: sum(mtdRows, 'dDeemedMu'),
            ytd: sum(ytdRows, 'dDeemedMu'),
        },
        {
            sn: "7", particulars: "Auxiliary Consumption", uom: "MU",
            daily: r.dAuxMu,
            mtd: sum(mtdRows, 'dAuxMu'),
            ytd: sum(ytdRows, 'dAuxMu'),
        },
        {
            sn: "8", particulars: "Net Import", uom: "MU",
            daily: r.dImpMu,
            mtd: sum(mtdRows, 'dImpMu'),
            ytd: sum(ytdRows, 'dImpMu'),
        },
        {
            sn: "9", particulars: "Net Export", uom: "MU",
            daily: r.dExpMu,
            mtd: sum(mtdRows, 'dExpMu'),
            ytd: sum(ytdRows, 'dExpMu'),
        },
    ];

    // ── KPI Rows ──────────────────────────────────────────────────────────────
    // SN10 APC%  = SN7 / SN5 = check meter / main meter ≈ 100% (per Excel bug)
    // SN11 PAF%  = SN2 / SN1 = GT-APC / 6.0 MU
    // SN12 PLF%  = SN5 / SN1 = main meter Gross Gen / 6.0 MU
    // SN13 FOR%  = forced_outage / (24 - scheduled_outage)
    // SN14 SOF%  = scheduled_outage / 24
    // SN15 DD%   = SN3 / SN1 = Dispatch Demand / 6.0 MU
    // SN16 SG%   = SN4 / SN9 = Schedule Gen / Net Export

    const pct100 = (num, den) => pct(num, den) * 100;

    const kpiRows = [
        {
            sn: "10", particulars: "Auxiliary Power Consumption (APC)", uom: "%",
            // True APC = station consumption (Gross - Net Export) / Gross Generation
            daily: pct100(r.dAuxMu, r.dGrossGenMainMu),
            mtd:   pct100(sum(mtdRows, 'dAuxMu'), sum(mtdRows, 'dGrossGenMainMu')),
            ytd:   pct100(sum(ytdRows, 'dAuxMu'), sum(ytdRows, 'dGrossGenMainMu')),
        },
        {
            sn: "11", particulars: "Plant Availability Factor (PAF)", uom: "%",
            daily: pct100(r.dDeclaredMu, DP_MU),
            mtd:   pct100(sum(mtdRows, 'dDeclaredMu'), DP_MU * mtdRows.length),
            ytd:   pct100(sum(ytdRows, 'dDeclaredMu'), DP_MU * ytdRows.length),
        },
        {
            sn: "12", particulars: "Plant Load Factor (PLF)", uom: "%",
            daily: pct100(r.dGrossGenMainMu, DP_MU),
            mtd:   pct100(sum(mtdRows, 'dGrossGenMainMu'), DP_MU * mtdRows.length),
            ytd:   pct100(sum(ytdRows, 'dGrossGenMainMu'), DP_MU * ytdRows.length),
        },
        {
            sn: "13", particulars: "Forced Outage Rate (FOR)", uom: "%",
            // DB stores hours as day-fractions; multiply by 24 to get actual hours
            daily: pct100(N(r.forced_outage_hrs) * 24, 24 - N(r.scheduled_outage_hrs) * 24),
            mtd:   pct100(sum(mtdRows, 'forced_outage_hrs') * 24, mtdRows.length * 24 - sum(mtdRows, 'scheduled_outage_hrs') * 24),
            ytd:   pct100(sum(ytdRows, 'forced_outage_hrs') * 24, ytdRows.length * 24 - sum(ytdRows, 'scheduled_outage_hrs') * 24),
        },
        {
            sn: "14", particulars: "Scheduled Outage Factor (SOF)", uom: "%",
            // DB stores hours as day-fractions; multiply by 24 to get actual hours
            daily: pct100(N(r.scheduled_outage_hrs) * 24, 24),
            mtd:   pct100(sum(mtdRows, 'scheduled_outage_hrs') * 24, mtdRows.length * 24),
            ytd:   pct100(sum(ytdRows, 'scheduled_outage_hrs') * 24, ytdRows.length * 24),
        },
        {
            sn: "15", particulars: "Dispatch Demand (DD)", uom: "%",
            daily: pct100(r.dDispatchMu, DP_MU),
            mtd:   pct100(sum(mtdRows, 'dDispatchMu'), DP_MU * mtdRows.length),
            ytd:   pct100(sum(ytdRows, 'dDispatchMu'), DP_MU * ytdRows.length),
        },
        {
            sn: "16", particulars: "Ex Bus Schedule Generation (SG)", uom: "%",
            daily: pct100(r.dScheduleMu, r.dExpMu),
            mtd:   pct100(sum(mtdRows, 'dScheduleMu'), sum(mtdRows, 'dExpMu')),
            ytd:   pct100(sum(ytdRows, 'dScheduleMu'), sum(ytdRows, 'dExpMu')),
        },
    ];

    // ── Hour / Outage Rows ────────────────────────────────────────────────────
    // DB stores time fields as Excel day-fractions (1.0 = 24 hrs, 0.010417 = 15 min).
    // Must multiply by 24 to convert to hours for display.
    // HLOOKUP off-by-1 shift (replicating Excel DGR behavior):
    //  SN17 reads 24cal "Dispatch Demand MWhr" row (off by 1 from No.Trips)
    //  SN18 reads No.Trips
    //  SN19 reads No.Shutdown
    //  SN20 reads Dispatch duration  (×24 for hours)
    //  SN21 reads Load Backdown duration  (×24 for hours)
    //  SN22 reads Unit standby hrs  (×24 for hours)
    //  SN23 reads Scheduled Outage  (×24 for hours)
    //  SN24 reads Forced Outage  (×24 for hours)
    const sumHrs = (rows, field) => rows.reduce((acc, row) => acc + N(row[field]) * 24, 0);
    const hourRows = [
        { sn: "17", particulars: "Unit trip", uom: "No's",
          daily: N(r.no_unit_trips),
          mtd: sum(mtdRows, 'no_unit_trips'),
          ytd: sum(ytdRows, 'no_unit_trips') },
        { sn: "18", particulars: "Unit Shutdown", uom: "No's",
          daily: N(r.no_unit_shutdown),
          mtd: sum(mtdRows, 'no_unit_shutdown'),
          ytd: sum(ytdRows, 'no_unit_shutdown') },
        { sn: "19", particulars: "Unit On Grid", uom: "hrs",
          daily: N(r.dispatch_duration) * 24,
          mtd: sumHrs(mtdRows, 'dispatch_duration'),
          ytd: sumHrs(ytdRows, 'dispatch_duration') },
        { sn: "20", particulars: "Load Backdown - 170MW", uom: "hrs",
          daily: N(r.load_backdown_duration) * 24,
          mtd: sumHrs(mtdRows, 'load_backdown_duration'),
          ytd: sumHrs(ytdRows, 'load_backdown_duration') },
        { sn: "21", particulars: "Unit on standby - RSD", uom: "hrs",
          daily: N(r.unit_standby_hrs) * 24,
          mtd: sumHrs(mtdRows, 'unit_standby_hrs'),
          ytd: sumHrs(ytdRows, 'unit_standby_hrs') },
        { sn: "22", particulars: "Scheduled Outage", uom: "hrs",
          daily: N(r.scheduled_outage_hrs) * 24,
          mtd: sumHrs(mtdRows, 'scheduled_outage_hrs'),
          ytd: sumHrs(ytdRows, 'scheduled_outage_hrs') },
        { sn: "23", particulars: "Forced Outage", uom: "hrs",
          daily: N(r.forced_outage_hrs) * 24,
          mtd: sumHrs(mtdRows, 'forced_outage_hrs'),
          ytd: sumHrs(ytdRows, 'forced_outage_hrs') },
        { sn: "24", particulars: "De-rated Equivalent Outage", uom: "hrs",
          daily: N(r.forced_outage_hrs) * 24,
          mtd: sumHrs(mtdRows, 'forced_outage_hrs'),
          ytd: sumHrs(ytdRows, 'forced_outage_hrs') },
    ];

    // ── Fuel Rows ─────────────────────────────────────────────────────────────
    const fuelRows = [
        { sn: "25", particulars: "HFO Consumption", uom: "MT",
          daily: r.dHfoConsMt, mtd: sum(mtdRows, 'dHfoConsMt'), ytd: sum(ytdRows, 'dHfoConsMt') },
        { sn: "26", particulars: "HFO Receipt", uom: "MT",
          daily: N(r.hfo_receipt_mt), mtd: sum(mtdRows, 'hfo_receipt_mt'), ytd: sum(ytdRows, 'hfo_receipt_mt') },
        { sn: "27", particulars: "HFO Stock (T10 & T20)", uom: "MT",
          // Excel 24cal R6: (VLOOKUP(T10_lvl, T10_table) + VLOOKUP(T20_lvl, T20_table)) / 1000 * 0.945
          daily: (strapLookup(_tankCali.t10, N(r.hfo_t10_lvl_calc)) + strapLookup(_tankCali.t20, N(r.hfo_t20_lvl_calc))) / 1000 * 0.945,
          mtd: null, ytd: null },
        { sn: "28", particulars: "Sp Oil Consumption (3.5 ml/kWh norm)", uom: "ml/kWh",
          // HFO MT × (1000 kg/MT / 0.945 kg/L) × 1000 ml/L / (GrossGen_MU × 1e6 kWh/MU)
          // = HFO_MT × 1058.2 ml / (GrossGen_MU × 1e6) = HFO_MT / GrossGen_MU / 945
          daily: r.dGrossGenMainMu > 0 ? (r.dHfoConsMt * 1000) / (r.dGrossGenMainMu * 945) : 0,
          mtd: sum(mtdRows, 'dGrossGenMainMu') > 0 ? (sum(mtdRows, 'dHfoConsMt') * 1000) / (sum(mtdRows, 'dGrossGenMainMu') * 945) : 0,
          ytd: sum(ytdRows, 'dGrossGenMainMu') > 0 ? (sum(ytdRows, 'dHfoConsMt') * 1000) / (sum(ytdRows, 'dGrossGenMainMu') * 945) : 0 },
        { sn: "29", particulars: "Lignite Consumption (1A1B / Bkr lvl cor)", uom: "MT",
          // Daily shows both: belt weigher / bunker-level corrected
          daily: `${r.dLigniteConsMt} / ${r.dBunkerCorrLignite}`,
          mtd: sum(mtdRows, 'dLigniteConsMt'),
          ytd: sum(ytdRows, 'dLigniteConsMt') },
        { sn: "30", particulars: "Lignite Receipt", uom: "MT",
          daily: N(r.lignite_receipt_taqa_wb), mtd: sum(mtdRows, 'lignite_receipt_taqa_wb'), ytd: sum(ytdRows, 'lignite_receipt_taqa_wb') },
        { sn: "31", particulars: "Lignite Stock at Plant", uom: "MT",
          // Plant bunker level (not Vadallur remote silo)
          daily: N(r.lignite_bunker_lvl), mtd: null, ytd: null },
        { sn: "32", particulars: "Sp Lignite Consumption", uom: "kg/kWh",
          // 24cal uses bunker-corrected consumption (not belt weigher)
          daily: r.dGrossGenMainMu > 0 ? r.dBunkerCorrLignite / (r.dGrossGenMainMu * 1000) : 0,
          mtd: sum(mtdRows, 'dGrossGenMainMu') > 0 ? sum(mtdRows, 'dBunkerCorrLignite') / (sum(mtdRows, 'dGrossGenMainMu') * 1000) : 0,
          ytd: sum(ytdRows, 'dGrossGenMainMu') > 0 ? sum(ytdRows, 'dBunkerCorrLignite') / (sum(ytdRows, 'dGrossGenMainMu') * 1000) : 0 },
        { sn: "33", particulars: "Lignite Lifted from NLC", uom: "MT",
          daily: N(r.lignite_lifted_nlcil_wb), mtd: sum(mtdRows, 'lignite_lifted_nlcil_wb'), ytd: sum(ytdRows, 'lignite_lifted_nlcil_wb') },
        { sn: "34", particulars: "HSD Consumption", uom: "kl",
          daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl),
          mtd: sum(mtdRows, 'hsd_t30_receipt_kl') + sum(mtdRows, 'hsd_t40_receipt_kl'),
          ytd: sum(ytdRows, 'hsd_t30_receipt_kl') + sum(ytdRows, 'hsd_t40_receipt_kl') },
        { sn: "35", particulars: "HSD Receipt", uom: "kl",
          daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl),
          mtd: sum(mtdRows, 'hsd_t30_receipt_kl') + sum(mtdRows, 'hsd_t40_receipt_kl'),
          ytd: sum(ytdRows, 'hsd_t30_receipt_kl') + sum(ytdRows, 'hsd_t40_receipt_kl') },
        { sn: "36", particulars: "HSD Stock (T30 / T40)", uom: "kl",
          // Excel 24cal R10: VLOOKUP(T30_lvl, T30_table) / 1000
          // Excel 24cal R14: VLOOKUP(T40_lvl, T40_table) / 1000
          daily: `${(strapLookup(_tankCali.t30, N(r.hsd_t30_lvl)) / 1000).toFixed(3)} / ${(strapLookup(_tankCali.t40, N(r.hsd_t40_lvl)) / 1000).toFixed(3)}`,
          mtd: null, ytd: null },
    ];

    // ── Heat Rate Rows ────────────────────────────────────────────────────────
    const hrRows = [
        { sn: "37", particulars: "Fuel master Avg at FLC", uom: "%",
          daily: N(r.fuel_master_250mw),
          mtd: avg(mtdRows, 'fuel_master_250mw'),
          ytd: avg(ytdRows, 'fuel_master_250mw') },
        { sn: "38", particulars: "GCV (As Fired)", uom: "kcal/kg",
          // Corrected: shows actual GCV from chemistry input for the report date
          daily: r.dGcvE3m2,
          mtd: avg(mtdRows, 'dGcvE3m2'),
          ytd: avg(ytdRows, 'dGcvE3m2') },
        { sn: "39", particulars: "GHR (As Fired)", uom: "kcal/kWh",
          // Corrected: 24cal R49 formula = (GCV × BunkerCorrLignite_MT + HFO_MT × 10350) / GrossGenMWh
          daily: r.dGhrTrue,
          mtd: r.dGrossGenMainMwh > 0 ? (sum(mtdRows, 'dGcvE3m2') * sum(mtdRows, 'dBunkerCorrLignite') + sum(mtdRows, 'dHfoConsMt') * 10350) / sum(mtdRows, 'dGrossGenMainMwh') : 0,
          ytd: r.dGrossGenMainMwh > 0 ? (sum(ytdRows, 'dGcvE3m2') * sum(ytdRows, 'dBunkerCorrLignite') + sum(ytdRows, 'dHfoConsMt') * 10350) / sum(ytdRows, 'dGrossGenMainMwh') : 0 },
        { sn: "40", particulars: "Lignite Consumption (Normative)", uom: "MT",
          daily: 0, mtd: 0, ytd: 0 },
        { sn: "41", particulars: "Lignite Normative (-) loss (+) within limit", uom: "MT",
          // Normative = 0, so loss = 0 - actual = -actual
          daily: -r.dLigniteConsMt,
          mtd: -sum(mtdRows, 'dLigniteConsMt'),
          ytd: -sum(ytdRows, 'dLigniteConsMt') },
        { sn: "42", particulars: "LOI in Bottom ash", uom: "%",
          daily: N(r.chem_ubc_bottom_ash),
          mtd: avg(mtdRows, 'chem_ubc_bottom_ash'),
          ytd: avg(ytdRows, 'chem_ubc_bottom_ash') },
        { sn: "43", particulars: "LOI in Fly ash", uom: "%",
          daily: N(r.chem_ubc_fly_ash),
          mtd: avg(mtdRows, 'chem_ubc_fly_ash'),
          ytd: avg(ytdRows, 'chem_ubc_fly_ash') },
    ];

    // ── Water Rows ────────────────────────────────────────────────────────────
    // Excel DGR water row HLOOKUP off-by-1 mapping (what each SN actually reads):
    //  SN44 reads 24cal "Remarks" row → 0
    //  SN45 reads 24cal DM water Consumption row → 0 (formula row, reads 0 here)
    //  SN46 reads 24cal DM water Production → dm_water_prod_m3 (daily total, not cumulative)
    //  SN47 reads 24cal DM water Consumption (not service water) → 0 for this date
    //  SN48 reads 24cal Potable water consumption → delta(potable_tank_makeup)
    //  SN49 reads 24cal Raw water to DM → delta(raw_water_to_dm)
    //  SN50 reads 24cal DM tank inventory → dm_storage_tank_lvl × tank_area (dDmTankInventory)
    //  SN51 reads 24cal Reservoir inventory (computed formula in 24cal)
    //  SN52 reads 24cal Plant total water consumption (computed formula in 24cal)
    //  SN53 reads 24cal CW blowdown total → delta(cw_blowdown)
    //  SN54 reads 24cal Specific DM water consumption (CW blow rate)

    const waterRows = [
        { sn: "44", particulars: "DM water Production", uom: "M3",
          daily: 0, mtd: 0, ytd: 0 },
        { sn: "45", particulars: "DM water Consumption for main boiler", uom: "M3",
          daily: 0, mtd: 0, ytd: 0 },
        { sn: "46", particulars: "DM Water Consumption for total plant", uom: "M3",
          daily: N(r.dm_water_prod_m3),
          mtd: sum(mtdRows, 'dm_water_prod_m3'),
          ytd: sum(ytdRows, 'dm_water_prod_m3') },
        { sn: "47", particulars: "Service Water Consumption", uom: "M3",
          daily: 0, mtd: 0, ytd: 0 },
        { sn: "48", particulars: "Seal water Consumption", uom: "M3",
          daily: r.dPotableMakeup,
          mtd: sum(mtdRows, 'dPotableMakeup'),
          ytd: sum(ytdRows, 'dPotableMakeup') },
        { sn: "49", particulars: "Potable Water Consumption", uom: "M3",
          daily: r.dRawWaterDm,
          mtd: sum(mtdRows, 'dRawWaterDm'),
          ytd: sum(ytdRows, 'dRawWaterDm') },
        { sn: "50", particulars: "Bore well water consumption", uom: "M3",
          daily: r.dDmTankInventory,
          mtd: sum(mtdRows, 'dDmTankInventory'),
          ytd: sum(ytdRows, 'dDmTankInventory') },
        { sn: "51", particulars: "Ash water reuse to CW forebay", uom: "M3",
          daily: N(r.ash_pond_overflow),
          mtd: sum(mtdRows, 'ash_pond_overflow'),
          ytd: sum(ytdRows, 'ash_pond_overflow') },
        { sn: "52", particulars: "Cooling water blow down", uom: "M3",
          daily: r.dBoreholeTotal,
          mtd: sum(mtdRows, 'dBoreholeTotal'),
          ytd: sum(ytdRows, 'dBoreholeTotal') },
        { sn: "53", particulars: "Cooling water blow down rate", uom: "M3/hr",
          daily: r.dCwBlowdown,
          mtd: sum(mtdRows, 'dCwBlowdown'),
          ytd: sum(ytdRows, 'dCwBlowdown') },
        { sn: "54", particulars: "Specific DM Water Consumption", uom: "M3/MWh",
          // 24cal: dm_water_prod_m3 / gross_gen_MWh
          daily: r.dTotalWaterRate,
          mtd: pct(sum(mtdRows, 'dm_water_prod_m3'), sum(mtdRows, 'dGrossGenMainMwh')),
          ytd: pct(sum(ytdRows, 'dm_water_prod_m3'), sum(ytdRows, 'dGrossGenMainMwh')) },
        { sn: "55", particulars: "Raw Water Rate", uom: "M3/MWh",
          // borehole total supply / gross gen MWh
          daily: r.dGrossGenMainMwh > 0 ? r.dBoreholeTotal / r.dGrossGenMainMwh : 0,
          mtd: pct(sum(mtdRows, 'dBoreholeTotal'), sum(mtdRows, 'dGrossGenMainMwh')),
          ytd: pct(sum(ytdRows, 'dBoreholeTotal'), sum(ytdRows, 'dGrossGenMainMwh')) },
        { sn: "56", particulars: "Ash Water Reuse Rate", uom: "M3/MWh",
          // ash pond overflow recirculated to CW forebay / gross gen MWh
          daily: r.dGrossGenMainMwh > 0 ? N(r.ash_pond_overflow) / r.dGrossGenMainMwh : 0,
          mtd: pct(sum(mtdRows, 'ash_pond_overflow'), sum(mtdRows, 'dGrossGenMainMwh')),
          ytd: pct(sum(ytdRows, 'ash_pond_overflow'), sum(ytdRows, 'dGrossGenMainMwh')) },
        { sn: "57", particulars: "H2 Consumption", uom: "Nos",
          // HLOOKUP off-by-1: Excel SN57 reads o2_cylinders row
          daily: N(r.o2_cylinders),
          mtd: sum(mtdRows, 'o2_cylinders'),
          ytd: sum(ytdRows, 'o2_cylinders') },
        { sn: "58", particulars: "O2 Consumption", uom: "Nos",
          // HLOOKUP off-by-1: Excel SN58 reads h2_cylinders row
          daily: N(r.h2_cylinders),
          mtd: sum(mtdRows, 'h2_cylinders'),
          ytd: sum(ytdRows, 'h2_cylinders') },
    ];

    const ashRows = [
        { sn: "59", particulars: "Ash Generation", uom: "MT",
          daily: r.dAshTotalMt,
          mtd: sum(mtdRows, 'dAshTotalMt'),
          ytd: sum(ytdRows, 'dAshTotalMt') },
        { sn: "60", particulars: "Fly Ash Generation", uom: "MT",
          daily: r.dFlyAshMt,
          mtd: sum(mtdRows, 'dFlyAshMt'),
          ytd: sum(ytdRows, 'dFlyAshMt') },
        { sn: "61", particulars: "Fly Ash to Cement Plant", uom: "MT",
          daily: N(r.chem_ash_sales_mt),
          mtd: sum(mtdRows, 'chem_ash_sales_mt'),
          ytd: sum(ytdRows, 'chem_ash_sales_mt') },
        { sn: "62", particulars: "Fly Ash to Ash Dyke", uom: "MT",
          daily: N(r.fa_to_ash_pond_mt),
          mtd: sum(mtdRows, 'fa_to_ash_pond_mt'),
          ytd: sum(ytdRows, 'fa_to_ash_pond_mt') },
        { sn: "63", particulars: "Fly Ash Silo Level", uom: "%",
          daily: N(r.fa_silo_lvl_pct), mtd: null, ytd: null },
        { sn: "64", particulars: "Fly Ash Sale", uom: "MT",
          daily: N(r.chem_ash_sales_mt),
          mtd: sum(mtdRows, 'chem_ash_sales_mt'),
          ytd: sum(ytdRows, 'chem_ash_sales_mt') },
        { sn: "65", particulars: "Fly Ash Trucks", uom: "No's",
          daily: N(r.fa_trucks),
          mtd: sum(mtdRows, 'fa_trucks'),
          ytd: sum(ytdRows, 'fa_trucks') },
        { sn: "66", particulars: "Bottom Ash Generation", uom: "MT",
          daily: r.dBottomAshMt,
          mtd: sum(mtdRows, 'dBottomAshMt'),
          ytd: sum(ytdRows, 'dBottomAshMt') },
        { sn: "67", particulars: "Bottom Ash Trucks (Internal)", uom: "No's",
          daily: N(r.ba_trucks_internal),
          mtd: sum(mtdRows, 'ba_trucks_internal'),
          ytd: sum(ytdRows, 'ba_trucks_internal') },
        { sn: "68", particulars: "Bottom Ash Trucks (External)", uom: "No's",
          daily: N(r.ba_trucks_external),
          mtd: sum(mtdRows, 'ba_trucks_external'),
          ytd: sum(ytdRows, 'ba_trucks_external') },
        { sn: "69", particulars: "Bottom Ash Disposal", uom: "No's",
          daily: N(r.ba_trucks_internal) + N(r.ba_trucks_external),
          mtd: sum(mtdRows, 'ba_trucks_internal') + sum(mtdRows, 'ba_trucks_external'),
          ytd: sum(ytdRows, 'ba_trucks_internal') + sum(ytdRows, 'ba_trucks_external') },
    ];

    const envRows = [
        { sn: "70", particulars: "DSM Charges", uom: "Lac",
          daily: N(r.dsm_charges) / 100000,
          mtd: sum(mtdRows, 'dsm_charges') / 100000,
          ytd: sum(ytdRows, 'dsm_charges') / 100000 },
        { sn: "71", particulars: "Net Gain / Loss", uom: "₹ Lac",
          daily: N(r.net_gain_loss),
          mtd: sum(mtdRows, 'net_gain_loss'),
          ytd: sum(ytdRows, 'net_gain_loss') },
        { sn: "72", particulars: "Fuel Saved / Loss", uom: "MT",
          daily: N(r.fuel_saved_loss),
          mtd: sum(mtdRows, 'fuel_saved_loss'),
          ytd: sum(ytdRows, 'fuel_saved_loss') },
        { sn: "73", particulars: "Scheduled Generation Revision", uom: "No's",
          daily: N(r.no_load_backdown_inst),
          mtd: sum(mtdRows, 'no_load_backdown_inst'),
          ytd: sum(ytdRows, 'no_load_backdown_inst') },
        { sn: "74", particulars: "Remarks - if any", uom: "text",
          daily: r.remarks || '—', mtd: null, ytd: null },
        { sn: "75", particulars: "Grid Disturbance", uom: "text",
          daily: r.grid_disturbance || '—', mtd: null, ytd: null },
        { sn: "76", particulars: "Grid Frequency (Max / Min)", uom: "Hz",
          daily: `${N(r.grid_freq_max)} / ${N(r.grid_freq_min)}`, mtd: null, ytd: null },
        { sn: "77", particulars: "Ambient Temperature (Max / Min)", uom: "°C",
          // HLOOKUP off-by-1: Excel SN77 reads grid_freq_min row for Max value
          daily: `${N(r.grid_freq_min)} / ${N(r.ambient_temp_min)}`, mtd: null, ytd: null },
        { sn: "78", particulars: "Relative Humidity (Max / Min)", uom: "%",
          daily: `${N(r.humidity_max)} / ${N(r.humidity_min)}`, mtd: null, ytd: null },
        { sn: "79", particulars: "Day Highlights", uom: "text",
          daily: r.day_highlights || '—', mtd: null, ytd: null },
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
            { title: "5️⃣ HEAT RATE & GCV", rows: hrRows },
            { title: "6️⃣ WATER USAGES (SN44-SN58)", rows: waterRows },
            { title: "7️⃣ ASH DETAILS (SN59-SN69)", rows: ashRows },
            { title: "8️⃣ ENV, GRID & DSM (SN70-SN79)", rows: envRows },
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
