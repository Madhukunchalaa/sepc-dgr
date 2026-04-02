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
  // Lignite inventory running balance (24cal row 22): opening = 92542 MT (Mar 31, 2025 closing)
  let _ligniteInventory = 92542;
  for (let i = 0; i < allRes.rows.length; i++) {
    const curr = allRes.rows[i];
    const currDateStr = safeDate(curr.entry_date);

    if (currDateStr >= fyStartDate) {
      // DATA MODEL:
      // curr  = DB entry for report date T  → direct field reads (receipts, stocks, chemistry)
      // dataRow  = DB entry for T-1          → integrator delta "previous" value
      // prevDataRow = DB entry for T-2        → integrator delta "prev-prev" & GCV lookback
      const dataRow = i > 0 ? allRes.rows[i - 1] : {};  // T-1 (prev integrator base)
      const prevDataRow = i > 1 ? allRes.rows[i - 2] : {};  // T-2 (GCV lookback E3-2)

      // ── Gross Generation ──────────────────────────────────────────────
      // delta = curr meter (T closing) - dataRow meter (T-1 closing) = T period generation
      // Use max(main, check) so that stale or under-reading main meter falls back to check meter
      // (mirrors 24cal manual override for days when main meter was malfunctioning)
      const _mainDelta = delta(curr.gen_main_meter, dataRow.gen_main_meter);
      const _checkDelta = delta(curr.gen_check_meter, dataRow.gen_check_meter);
      const dGrossGenMainMwh = Math.max(_mainDelta, _checkDelta) * MF_GEN;
      const dGrossGenMainMu = dGrossGenMainMwh / 1000;

      // Excel DGR SN7 reads 24cal "Gross Gen - Check Meter" (HLOOKUP row off-by-1)
      const dGenMu = (delta(curr.gen_check_meter, dataRow.gen_check_meter) * MF_GEN) / 1000;

      // ── GT Bay / GT-APC ───────────────────────────────────────────────
      const dGtBayExpMwh = delta(curr.gt_bay_imp_rdg, dataRow.gt_bay_imp_rdg) * (230 / 110) * 1000;
      const dGtApcMu = Math.max(0, dGrossGenMainMu - dGtBayExpMwh / 1000);

      // ── Export / Import ── direct reads from curr (T's Ops Input)
      const dExpMu = N(curr.net_export) / 1000;
      const dImpMu = N(curr.net_import_sy) / 1000;

      // ── Excel DGR HLOOKUP off-by-1 verified against actual '24 cal' sheet formulas ──
      // '24 cal' rows (actual content, verified from Excel formula extraction):
      //   Row 24: Export main meters (DB: net_export)
      //   Row 27: Station net export = E24 - E31 (DB: net_export - net_import_sy)
      //   Row 28: Schedule Gen MLDC (DB: schedule_gen_mldc)
      //   Row 31: Net Import partly (DB: net_import_sy)
      //   Row 32: Gross Gen Main meter (engine: dGrossGenMainMwh)
      //   Row 33: Gross Gen Check meter (engine: dGenMu * 1000)
      //   Row 34: Aux Power Export based = E32-E24 (engine: dGrossGenMainMwh - net_export)
      //   Row 36: Aux Power GT based = E32-E26 (engine: dGtApcMu * 1000)
      //   Row 37: Declared capacity (DB: declared_capacity_mwhr + deemed_gen_mwhr)
      //   Row 38: Deemed Generation (DB: declared_capacity_mwhr)
      //   Row 39: Dispatch Demand (DB: deemed_gen_mwhr)
      //
      // HLOOKUP DAILY reads the row listed above.
      // SUMIFS MTD/YTD reads the NEXT row (one below daily's row).
      //
      // SN2 "Declared Capacity": Daily=row36(GT-APC), MTD=row37(Declared capacity)
      // SN3 "Dispatch Demand":   Daily=row38(Deemed gen), MTD=row39(Dispatch demand)
      // SN4 "Schedule Gen":      Daily=row27(Station net export), MTD=row28(Sched MLDC)
      // SN6 "Deemed Gen":        Daily=row37(Declared capacity), MTD=row38(Deemed gen)
      // SN7 "Aux Consumption":   Daily=row33(Gross check meter), MTD=row34(Aux export based)
      // SN8 "Net Import":        Daily=row30(0 when running), MTD=row31(partial import)
      // SN9 "Net Export":        Daily=row24(Export main), MTD=row24(same)

      // SN2 daily = '24cal' row 36 = GT-based APC = E32 - E26
      const dDeclaredMu = dGtApcMu;
      // SN2 MTD/YTD = '24cal' row 37 = Declared capacity = declared + deemed
      const dDeclaredMtdMu = (N(curr.declared_capacity_mwhr) + N(curr.deemed_gen_mwhr)) / 1000;

      // SN3 daily = '24cal' row 38 = Deemed Generation = Ops Input E56 = declared_capacity_mwhr
      const dDispatchMu = N(curr.declared_capacity_mwhr) / 1000;
      // SN3 MTD/YTD = '24cal' row 39 = Dispatch Demand = Ops Input E57 = deemed_gen_mwhr
      const dDispatchMtdMu = N(curr.deemed_gen_mwhr) / 1000;

      // SN4 daily = '24cal' row 27 = Station Net Export = E24 - E31 = net_export - net_import_sy
      const dScheduleMu = (N(curr.net_export) - N(curr.net_import_sy)) / 1000;
      // SN4 MTD/YTD = '24cal' row 28 = Schedule Gen MLDC = Ops Input E46
      const dScheduleMtdMu = N(curr.schedule_gen_mldc) / 1000;

      // SN6 daily = '24cal' row 37 = Declared capacity = declared + deemed
      const dDeemedMu = (N(curr.declared_capacity_mwhr) + N(curr.deemed_gen_mwhr)) / 1000;
      // SN6 MTD/YTD = '24cal' row 38 = Deemed Generation = declared_capacity_mwhr
      const dDeemedMtdMu = N(curr.declared_capacity_mwhr) / 1000;

      // SN7 daily = '24cal' row 33 = Gross Gen Check meter
      const dAuxMu = dGenMu;
      // SN7 MTD/YTD = '24cal' row 34 = Aux Power Export based = E32 - E24 = gross_gen_main - net_export
      const dAuxMtdMu = (dGrossGenMainMwh - N(curr.net_export)) / 1000;

      // ── HFO (stock balance: Excel 24cal R5 = prev_stock + receipt - curr_stock) ──
      const _prevHfoStockMt = (strapLookup(_tankCali.t10, N(dataRow.hfo_t10_lvl_calc)) + strapLookup(_tankCali.t20, N(dataRow.hfo_t20_lvl_calc))) / 1000 * 0.945;
      const _currHfoStockMt = (strapLookup(_tankCali.t10, N(curr.hfo_t10_lvl_calc)) + strapLookup(_tankCali.t20, N(curr.hfo_t20_lvl_calc))) / 1000 * 0.945;
      const _hfoBalance = _prevHfoStockMt + N(curr.hfo_receipt_mt) - _currHfoStockMt;
      // Excel threshold: if balance < 0.3 MT treat as 0 (noise / rounding)
      const dHfoConsMt = _hfoBalance < 0.3 ? 0 : Math.max(0, _hfoBalance);

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

      // ── HSD (stock balance: Excel 24cal R9/R13 = prev_stock + receipt - curr_stock) ──
      const _prevHsdT30Kl = strapLookup(_tankCali.t30, N(dataRow.hsd_t30_lvl)) / 1000;
      const _currHsdT30Kl = strapLookup(_tankCali.t30, N(curr.hsd_t30_lvl)) / 1000;
      const _dHsdT30 = Math.max(0, _prevHsdT30Kl + N(curr.hsd_t30_receipt_kl) - _currHsdT30Kl);
      const _prevHsdT40Kl = strapLookup(_tankCali.t40, N(dataRow.hsd_t40_lvl)) / 1000;
      const _currHsdT40Kl = strapLookup(_tankCali.t40, N(curr.hsd_t40_lvl)) / 1000;
      const _dHsdT40 = Math.max(0, _prevHsdT40Kl + N(curr.hsd_t40_receipt_kl) - _currHsdT40Kl);
      const dHsdConsKl = _dHsdT30 + _dHsdT40;

      // ── Lignite running inventory (24cal R22): cumulative balance ──────
      _ligniteInventory += N(curr.lignite_receipt_taqa_wb) - dLigniteConsMt;
      const dLigniteInventory = _ligniteInventory;

      // ── Water (cumulative integrator deltas: curr - dataRow) ──────────
      const DM_TANK_FACTOR = (22 * 8.5 * 8.5) / (7 * 4); // ≈ 56.77 m²
      const dPotableMakeup = delta(curr.potable_tank_makeup, dataRow.potable_tank_makeup);
      const dRawWaterDm = delta(curr.raw_water_to_dm, dataRow.raw_water_to_dm);
      const dCwBlowdown = delta(curr.cw_blowdown, dataRow.cw_blowdown);
      const dServiceWater = delta(curr.service_water_flow, dataRow.service_water_flow);
      const dSealWater = delta(curr.seal_water_supply, dataRow.seal_water_supply);
      const dBoreholeTotal = delta(curr.borewell_to_reservoir, dataRow.borewell_to_reservoir)
        + delta(curr.borewell_to_cw_forebay, dataRow.borewell_to_cw_forebay);
      const dDmTankInventory = N(curr.dm_storage_tank_lvl) * DM_TANK_FACTOR;
      const dTotalWaterRate = dGrossGenMainMwh > 0 ? N(curr.dm_water_prod_m3) / dGrossGenMainMwh : 0;
      // Ash totals = 1A1B belt weigher consumption × ash content %
      // Excel 24cal R125 formula: = R18 * ash_pct/100 (uses 1A1B consumption, not receipt)
      const dAshTotalMt = (dLigniteConsMt * N(curr.chem_ash_pct)) / 100;
      const dFlyAshMt = dAshTotalMt * 0.8;
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
        dScheduleMtdMu,
        dDispatchMu,
        dDispatchMtdMu,
        dDeemedMu,
        dDeemedMtdMu,
        dDeclaredMu,
        dDeclaredMtdMu,
        dAuxMu,
        dAuxMtdMu,
        dHfoConsMt,
        dHsdConsKl,
        dLigniteConsMt,
        dBunkerCorrLignite,
        dLigniteInventory,
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
  const t2Day = calculatedDays.length >= 3 ? calculatedDays[calculatedDays.length - 3] : null; // T-2 day for GCV/GHR
  console.log(`[taqa.engine] DEBUG: targetDate=${targetDate}, dGtApcMu=${r.dGtApcMu?.toFixed(4)}, dGrossGenMainMu=${r.dGrossGenMainMu?.toFixed(4)}`);

  const mtdRows = calculatedDays.filter(d => safeDate(d.entry_date).slice(0, 7) === targetDate.slice(0, 7));
  const ytdRows = calculatedDays;

  const sum = (rows, field) => rows.reduce((acc, row) => acc + (N(row[field]) || 0), 0);
  const avg = (rows, field) => rows.length ? sum(rows, field) / rows.length : 0;
  const pct = (num, den) => (den != null && Number(den) > 0) ? (Number(num) / Number(den)) : 0;

  // ── Generation Rows ───────────────────────────────────────────────────────
  // DAILY: HLOOKUP off-by-1 reads one row above the label's intended data.
  // MTD/YTD: SUMIFS reads the correct (intended) row.
  //  SN2  Daily=row36(GT-APC),          MTD=row37(Declared capacity sum)
  //  SN3  Daily=row38(Deemed gen),       MTD=row39(Dispatch demand sum)
  //  SN4  Daily=row27(Station net exp),  MTD=row28(Schedule gen MLDC sum)
  //  SN5 
  //  Daily=row32(Gross gen main),   MTD=row32(same)
  //  SN6  Daily=row37(Declared cap),     MTD=row38(Deemed gen sum)
  //  SN7  Daily=row33(Gross gen check),  MTD=row34(Aux power export based sum)
  //  SN8  Daily=row30(0 when running),   MTD=row31(partial import sum)
  //  SN9  Daily=row24(Export main),      MTD=row24(same)

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
      mtd: sum(mtdRows, 'dDeclaredMtdMu'),
      ytd: sum(ytdRows, 'dDeclaredMtdMu'),
    },
    {
      sn: "3", particulars: "Dispatch Demand", uom: "MU",
      daily: r.dDispatchMu,
      mtd: sum(mtdRows, 'dDispatchMtdMu'),
      ytd: sum(ytdRows, 'dDispatchMtdMu'),
    },
    {
      sn: "4", particulars: "Schedule Generation", uom: "MU",
      daily: r.dScheduleMu,
      mtd: sum(mtdRows, 'dScheduleMtdMu'),
      ytd: sum(ytdRows, 'dScheduleMtdMu'),
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
      mtd: sum(mtdRows, 'dDeemedMtdMu'),
      ytd: sum(ytdRows, 'dDeemedMtdMu'),
    },
    {
      sn: "7", particulars: "Auxiliary Consumption", uom: "MU",
      // Daily: row33 = Gross Gen Check meter (off-by-1, shows ≈SN5)
      // MTD: row34 = Aux Power Export based = gross_gen_main - net_export
      daily: r.dAuxMu,
      mtd: sum(mtdRows, 'dAuxMtdMu'),
      ytd: sum(ytdRows, 'dAuxMtdMu'),
    },
    {
      sn: "8", particulars: "Net Import", uom: "MU",
      // Daily: row30 = 0 when unit generating (only non-zero when fully shutdown all day)
      // MTD: row31 = partial import (net_import_sy)
      daily: r.dGrossGenMainMwh > 0 ? 0 : r.dImpMu,
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
      // Daily: row33/row32 = gross_gen_check/gross_gen_main ≈ 100% (Excel HLOOKUP off-by-1)
      // MTD/YTD: row34/row32 = aux_power_export_based/gross_gen_main (actual APC%)
      daily: pct100(r.dAuxMu, r.dGrossGenMainMu),
      mtd: pct100(sum(mtdRows, 'dAuxMtdMu'), sum(mtdRows, 'dGrossGenMainMu')),
      ytd: pct100(sum(ytdRows, 'dAuxMtdMu'), sum(ytdRows, 'dGrossGenMainMu')),
    },
    {
      sn: "11", particulars: "Plant Availability Factor (PAF)", uom: "%",
      daily: pct100(r.dDeclaredMu, DP_MU),
      mtd: pct100(sum(mtdRows, 'dDeclaredMtdMu'), DP_MU * mtdRows.length),
      ytd: pct100(sum(ytdRows, 'dDeclaredMtdMu'), DP_MU * ytdRows.length),
    },
    {
      sn: "12", particulars: "Plant Load Factor (PLF)", uom: "%",
      // PLF = Gross Generation / Rated Capacity (matches Excel DGR)
      daily: pct100(r.dGrossGenMainMu, DP_MU),
      mtd: pct100(sum(mtdRows, 'dGrossGenMainMu'), DP_MU * mtdRows.length),
      ytd: pct100(sum(ytdRows, 'dGrossGenMainMu'), DP_MU * ytdRows.length),
    },
    {
      sn: "13", particulars: "Forced Outage Rate (FOR)", uom: "%",
      // Excel FOR% = (forced_outage_hrs + derated_outage_hrs) / 24 — denominator always 24, not net of scheduled
      daily: pct100((N(r.forced_outage_hrs) + N(r.derated_outage_hrs)) * 24, 24),
      mtd: pct100((sum(mtdRows, 'forced_outage_hrs') + sum(mtdRows, 'derated_outage_hrs')) * 24, mtdRows.length * 24),
      ytd: pct100((sum(ytdRows, 'forced_outage_hrs') + sum(ytdRows, 'derated_outage_hrs')) * 24, ytdRows.length * 24),
    },
    {
      sn: "14", particulars: "Scheduled Outage Factor (SOF)", uom: "%",
      // DB stores hours as day-fractions; multiply by 24 to get actual hours
      daily: pct100(N(r.scheduled_outage_hrs) * 24, 24),
      mtd: pct100(sum(mtdRows, 'scheduled_outage_hrs') * 24, mtdRows.length * 24),
      ytd: pct100(sum(ytdRows, 'scheduled_outage_hrs') * 24, ytdRows.length * 24),
    },
    {
      sn: "15", particulars: "Dispatch Demand (DD)", uom: "%",
      daily: pct100(r.dDispatchMu, DP_MU),
      mtd: pct100(sum(mtdRows, 'dDispatchMtdMu'), DP_MU * mtdRows.length),
      ytd: pct100(sum(ytdRows, 'dDispatchMtdMu'), DP_MU * ytdRows.length),
    },
    {
      sn: "16", particulars: "Ex Bus Schedule Generation (SG)", uom: "%",
      // Excel 24cal R29 = E24/E28 = Export_main / Schedule_MLDC
      // Daily: row24(net_export) / row28(schedule_gen_mldc)
      // MTD/YTD: sum(row24) / sum(row28)
      daily: pct100(r.dExpMu, r.dScheduleMtdMu),
      mtd: pct100(sum(mtdRows, 'dExpMu'), sum(mtdRows, 'dScheduleMtdMu')),
      ytd: pct100(sum(ytdRows, 'dExpMu'), sum(ytdRows, 'dScheduleMtdMu')),
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
    // HLOOKUP off-by-1: daily reads one row above; MTD/YTD SUM reads the correct row.
    {
      sn: "17", particulars: "Unit trip", uom: "No's",
      // Daily: HLOOKUP row39 = Dispatch Demand (off-by-1 from No.Trips row40) = deemed_gen_mwhr
      // MTD/YTD: SUM row40 = no_unit_trips directly
      daily: N(r.deemed_gen_mwhr),
      mtd: sum(mtdRows, 'no_unit_trips'),
      ytd: sum(ytdRows, 'no_unit_trips')
    },
    {
      sn: "18", particulars: "Unit Shutdown", uom: "No's",
      // Daily: HLOOKUP reads no_unit_trips (off-by-1)
      // MTD/YTD: SUM reads no_unit_shutdown directly
      daily: N(r.no_unit_trips),
      mtd: sum(mtdRows, 'no_unit_shutdown'),
      ytd: sum(ytdRows, 'no_unit_shutdown')
    },
    {
      sn: "19", particulars: "Unit On Grid", uom: "hrs",
      // Daily: HLOOKUP reads no_unit_shutdown (off-by-1)
      // MTD/YTD: SUM reads dispatch_duration ×24
      daily: N(r.no_unit_shutdown),
      mtd: sumHrs(mtdRows, 'dispatch_duration'),
      ytd: sumHrs(ytdRows, 'dispatch_duration')
    },
    {
      sn: "20", particulars: "Load Backdown - 170MW", uom: "hrs",
      // Daily: HLOOKUP reads dispatch_duration ×24 (off-by-1)
      // MTD/YTD: SUM reads load_backdown_duration ×24
      daily: N(r.dispatch_duration) * 24,
      mtd: sumHrs(mtdRows, 'load_backdown_duration'),
      ytd: sumHrs(ytdRows, 'load_backdown_duration')
    },
    {
      sn: "21", particulars: "Unit on standby - RSD", uom: "hrs",
      // Daily: HLOOKUP reads load_backdown_duration ×24 (off-by-1)
      // MTD/YTD: SUM reads unit_standby_hrs ×24
      daily: N(r.load_backdown_duration) * 24,
      mtd: sumHrs(mtdRows, 'unit_standby_hrs'),
      ytd: sumHrs(ytdRows, 'unit_standby_hrs')
    },
    {
      sn: "22", particulars: "Scheduled Outage", uom: "hrs",
      // Daily: HLOOKUP reads unit_standby_hrs ×24 (off-by-1)
      // MTD/YTD: SUM reads scheduled_outage_hrs ×24
      daily: N(r.unit_standby_hrs) * 24,
      mtd: sumHrs(mtdRows, 'scheduled_outage_hrs'),
      ytd: sumHrs(ytdRows, 'scheduled_outage_hrs')
    },
    {
      sn: "23", particulars: "Forced Outage", uom: "hrs",
      // Daily: HLOOKUP reads scheduled_outage_hrs ×24 (off-by-1)
      // MTD/YTD: SUM reads forced_outage_hrs ×24
      daily: N(r.scheduled_outage_hrs) * 24,
      mtd: sumHrs(mtdRows, 'forced_outage_hrs'),
      ytd: sumHrs(ytdRows, 'forced_outage_hrs')
    },
    {
      sn: "24", particulars: "De-rated Equivalent Outage", uom: "hrs",
      // Daily: HLOOKUP reads forced_outage_hrs ×24 (off-by-1)
      // MTD/YTD: SUM reads derated_outage_hrs ×24
      daily: N(r.forced_outage_hrs) * 24,
      mtd: sumHrs(mtdRows, 'derated_outage_hrs'),
      ytd: sumHrs(ytdRows, 'derated_outage_hrs')
    },
  ];

  // ── Fuel Rows ─────────────────────────────────────────────────────────────
  const fuelRows = [
    {
      sn: "25", particulars: "HFO Consumption", uom: "MT",
      daily: r.dHfoConsMt, mtd: sum(mtdRows, 'dHfoConsMt'), ytd: sum(ytdRows, 'dHfoConsMt')
    },
    {
      sn: "26", particulars: "HFO Receipt", uom: "MT",
      daily: N(r.hfo_receipt_mt), mtd: sum(mtdRows, 'hfo_receipt_mt'), ytd: sum(ytdRows, 'hfo_receipt_mt')
    },
    {
      sn: "27", particulars: "HFO Stock (T10 & T20)", uom: "MT",
      // Excel 24cal R6: (VLOOKUP(T10_lvl, T10_table) + VLOOKUP(T20_lvl, T20_table)) / 1000 * 0.945
      daily: (strapLookup(_tankCali.t10, N(r.hfo_t10_lvl_calc)) + strapLookup(_tankCali.t20, N(r.hfo_t20_lvl_calc))) / 1000 * 0.945,
      mtd: null, ytd: null
    },
    {
      sn: "28", particulars: "Sp Oil Consumption (3.5 ml/kWh norm)", uom: "ml/kWh",
      // HFO MT × (1000 kg/MT / 0.945 kg/L) × 1000 ml/L / (GrossGen_MU × 1e6 kWh/MU)
      // = HFO_MT × 1058.2 ml / (GrossGen_MU × 1e6) = HFO_MT / GrossGen_MU / 945
      daily: r.dGrossGenMainMu > 0 ? (r.dHfoConsMt * 1000) / (r.dGrossGenMainMu * 945) : 0,
      mtd: sum(mtdRows, 'dGrossGenMainMu') > 0 ? (sum(mtdRows, 'dHfoConsMt') * 1000) / (sum(mtdRows, 'dGrossGenMainMu') * 945) : 0,
      ytd: sum(ytdRows, 'dGrossGenMainMu') > 0 ? (sum(ytdRows, 'dHfoConsMt') * 1000) / (sum(ytdRows, 'dGrossGenMainMu') * 945) : 0
    },
    {
      sn: "29", particulars: "Lignite Consumption (1A1B / Bkr lvl cor)", uom: "MT",
      // Daily shows both: belt weigher / bunker-level corrected
      daily: `${r.dLigniteConsMt} / ${r.dBunkerCorrLignite}`,
      mtd: sum(mtdRows, 'dLigniteConsMt'),
      ytd: sum(ytdRows, 'dLigniteConsMt')
    },
    {
      sn: "30", particulars: "Lignite Receipt", uom: "MT",
      daily: N(r.lignite_receipt_taqa_wb), mtd: sum(mtdRows, 'lignite_receipt_taqa_wb'), ytd: sum(ytdRows, 'lignite_receipt_taqa_wb')
    },
    {
      sn: "31", particulars: "Lignite Stock at Plant", uom: "MT",
      // Running inventory balance (24cal R22): cumulative prev_inventory + receipt - consumption
      daily: r.dLigniteInventory, mtd: null, ytd: null
    },
    {
      sn: "32", particulars: "Sp Lignite Consumption", uom: "kg/kWh",
      // Daily: bunker-corrected (24cal R21/R32); MTD/YTD: 1A1B belt weigher (Excel SUMIFS reads R18)
      daily: r.dGrossGenMainMu > 0 ? r.dBunkerCorrLignite / (r.dGrossGenMainMu * 1000) : 0,
      mtd: sum(mtdRows, 'dGrossGenMainMu') > 0 ? sum(mtdRows, 'dLigniteConsMt') / (sum(mtdRows, 'dGrossGenMainMu') * 1000) : 0,
      ytd: sum(ytdRows, 'dGrossGenMainMu') > 0 ? sum(ytdRows, 'dLigniteConsMt') / (sum(ytdRows, 'dGrossGenMainMu') * 1000) : 0
    },
    {
      sn: "33", particulars: "Lignite Lifted from NLC", uom: "MT",
      daily: N(r.lignite_lifted_nlcil_wb), mtd: sum(mtdRows, 'lignite_lifted_nlcil_wb'), ytd: sum(ytdRows, 'lignite_lifted_nlcil_wb')
    },
    {
      sn: "34", particulars: "HSD Consumption", uom: "kl",
      // Stock balance: Excel 24cal R9/R13 = prev_stock + receipt - curr_stock
      daily: r.dHsdConsKl,
      mtd: sum(mtdRows, 'dHsdConsKl'),
      ytd: sum(ytdRows, 'dHsdConsKl')
    },
    {
      sn: "35", particulars: "HSD Receipt", uom: "kl",
      daily: N(r.hsd_t30_receipt_kl) + N(r.hsd_t40_receipt_kl),
      mtd: sum(mtdRows, 'hsd_t30_receipt_kl') + sum(mtdRows, 'hsd_t40_receipt_kl'),
      ytd: sum(ytdRows, 'hsd_t30_receipt_kl') + sum(ytdRows, 'hsd_t40_receipt_kl')
    },
    {
      sn: "36", particulars: "HSD Stock (T30 / T40)", uom: "kl",
      // Excel 24cal R10: VLOOKUP(T30_lvl, T30_table) / 1000
      // Excel 24cal R14: VLOOKUP(T40_lvl, T40_table) / 1000
      daily: `${(strapLookup(_tankCali.t30, N(r.hsd_t30_lvl)) / 1000).toFixed(3)} / ${(strapLookup(_tankCali.t40, N(r.hsd_t40_lvl)) / 1000).toFixed(3)}`,
      mtd: null, ytd: null
    },
  ];

  // ── Heat Rate Rows ────────────────────────────────────────────────────────
  const hrRows = [
    {
      sn: "37", particulars: "Fuel master Avg at FLC", uom: "%",
      daily: N(r.fuel_master_250mw),
      mtd: avg(mtdRows, 'fuel_master_250mw'),
      ytd: avg(ytdRows, 'fuel_master_250mw')
    },
    {
      sn: "38", particulars: "GCV (As Fired)", uom: "kcal/kg",
      // Excel DGR row 47: HLOOKUP(E3-2, ...) — shows GCV from T-2 day (lab analysis lag)
      daily: t2Day?.dGcvE3m2 ?? r.dGcvE3m2,
      mtd: avg(mtdRows, 'dGcvE3m2'),
      ytd: avg(ytdRows, 'dGcvE3m2')
    },
    {
      sn: "39", particulars: "GHR (As Fired)", uom: "kcal/kWh",
      // Daily: GHR from T-2 day (Excel HLOOKUP off-by-1)
      // MTD/YTD: Excel 24cal R42 = (F41/1000*F32)/F8 = avg(GCV)*sum(1A1B)/sum(GrossGen_MU)
      //   = avg(GCV) * sum(dLigniteConsMt) / (sum(dGrossGenMainMwh)/1000)
      //   = avg(GCV) * sum(dLigniteConsMt) * 1000 / sum(dGrossGenMainMwh)  [kcal/kg * MT * 1000 kg/MT / MWh = kcal/MWh / 1000 → need /1000 to get kcal/kWh]
      //   Simplified: avg(GCV) * sum(dLigniteConsMt) / sum(dGrossGenMainMwh) * 1000
      //   But wait: GCV kcal/kg × MT × 1000 kg/MT = kcal; ÷ MWh × (1MWh/1000kWh) = kcal/kWh ✓
      daily: t2Day?.dGhrTrue ?? r.dGhrTrue,
      mtd: sum(mtdRows, 'dGrossGenMainMwh') > 0
        ? (avg(mtdRows, 'dGcvE3m2') * sum(mtdRows, 'dLigniteConsMt') * 1000 + sum(mtdRows, 'dHfoConsMt') * 10350 * 1000) / sum(mtdRows, 'dGrossGenMainMwh') / 1000
        : 0,
      ytd: sum(ytdRows, 'dGrossGenMainMwh') > 0
        ? (avg(ytdRows, 'dGcvE3m2') * sum(ytdRows, 'dLigniteConsMt') * 1000 + sum(ytdRows, 'dHfoConsMt') * 10350 * 1000) / sum(ytdRows, 'dGrossGenMainMwh') / 1000
        : 0
    },
    {
      sn: "40", particulars: "Lignite Consumption (Normative)", uom: "MT",
      daily: 0, mtd: 0, ytd: 0
    },
    {
      sn: "41", particulars: "Lignite Normative (-) loss (+) within limit", uom: "MT",
      // Normative = 0, so loss = 0 - actual = -actual
      daily: -r.dLigniteConsMt,
      mtd: -sum(mtdRows, 'dLigniteConsMt'),
      ytd: -sum(ytdRows, 'dLigniteConsMt')
    },
    {
      sn: "42", particulars: "LOI in Bottom ash", uom: "%",
      // HLOOKUP off-by-1: Excel DGR reads fly_ash row for "LOI in Bottom ash"
      daily: N(r.chem_ubc_fly_ash),
      mtd: avg(mtdRows, 'chem_ubc_fly_ash'),
      ytd: avg(ytdRows, 'chem_ubc_fly_ash')
    },
    {
      sn: "43", particulars: "LOI in Fly ash", uom: "%",
      // HLOOKUP off-by-1: Excel DGR reads bottom_ash row for "LOI in Fly ash"
      daily: N(r.chem_ubc_bottom_ash),
      mtd: avg(mtdRows, 'chem_ubc_bottom_ash'),
      ytd: avg(ytdRows, 'chem_ubc_bottom_ash')
    },
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
    {
      sn: "44", particulars: "DM water Production", uom: "M3",
      daily: 0, mtd: 0, ytd: 0
    },
    {
      sn: "45", particulars: "DM water Consumption for main boiler", uom: "M3",
      daily: 0, mtd: 0, ytd: 0
    },
    {
      sn: "46", particulars: "DM Water Consumption for total plant", uom: "M3",
      daily: N(r.dm_water_prod_m3),
      mtd: sum(mtdRows, 'dm_water_prod_m3'),
      ytd: sum(ytdRows, 'dm_water_prod_m3')
    },
    {
      sn: "47", particulars: "Service Water Consumption", uom: "M3",
      daily: 0, mtd: 0, ytd: 0
    },
    {
      sn: "48", particulars: "Seal water Consumption", uom: "M3",
      daily: r.dPotableMakeup,
      mtd: sum(mtdRows, 'dPotableMakeup'),
      ytd: sum(ytdRows, 'dPotableMakeup')
    },
    {
      sn: "49", particulars: "Potable Water Consumption", uom: "M3",
      daily: r.dRawWaterDm,
      mtd: sum(mtdRows, 'dRawWaterDm'),
      ytd: sum(ytdRows, 'dRawWaterDm')
    },
    {
      sn: "50", particulars: "Bore well water consumption", uom: "M3",
      daily: r.dDmTankInventory,
      mtd: sum(mtdRows, 'dDmTankInventory'),
      ytd: sum(ytdRows, 'dDmTankInventory')
    },
    {
      sn: "51", particulars: "Ash water reuse to CW forebay", uom: "M3",
      daily: N(r.ash_pond_overflow),
      mtd: sum(mtdRows, 'ash_pond_overflow'),
      ytd: sum(ytdRows, 'ash_pond_overflow')
    },
    {
      sn: "52", particulars: "Cooling water blow down", uom: "M3",
      daily: r.dBoreholeTotal,
      mtd: sum(mtdRows, 'dBoreholeTotal'),
      ytd: sum(ytdRows, 'dBoreholeTotal')
    },
    {
      sn: "53", particulars: "Cooling water blow down rate", uom: "M3/hr",
      daily: r.dCwBlowdown,
      mtd: sum(mtdRows, 'dCwBlowdown'),
      ytd: sum(ytdRows, 'dCwBlowdown')
    },
    {
      sn: "54", particulars: "Specific DM Water Consumption", uom: "M3/MWh",
      // 24cal: dm_water_prod_m3 / gross_gen_MWh
      daily: r.dTotalWaterRate,
      mtd: pct(sum(mtdRows, 'dm_water_prod_m3'), sum(mtdRows, 'dGrossGenMainMwh')),
      ytd: pct(sum(ytdRows, 'dm_water_prod_m3'), sum(ytdRows, 'dGrossGenMainMwh'))
    },
    {
      sn: "55", particulars: "Raw Water Rate", uom: "M3/MWh",
      // borehole total supply / gross gen MWh
      daily: r.dGrossGenMainMwh > 0 ? r.dBoreholeTotal / r.dGrossGenMainMwh : 0,
      mtd: pct(sum(mtdRows, 'dBoreholeTotal'), sum(mtdRows, 'dGrossGenMainMwh')),
      ytd: pct(sum(ytdRows, 'dBoreholeTotal'), sum(ytdRows, 'dGrossGenMainMwh'))
    },
    {
      sn: "56", particulars: "Ash Water Reuse Rate", uom: "M3/MWh",
      // ash pond overflow recirculated to CW forebay / gross gen MWh
      daily: r.dGrossGenMainMwh > 0 ? N(r.ash_pond_overflow) / r.dGrossGenMainMwh : 0,
      mtd: pct(sum(mtdRows, 'ash_pond_overflow'), sum(mtdRows, 'dGrossGenMainMwh')),
      ytd: pct(sum(ytdRows, 'ash_pond_overflow'), sum(ytdRows, 'dGrossGenMainMwh'))
    },
    {
      sn: "57", particulars: "H2 Consumption", uom: "Nos",
      // HLOOKUP off-by-1: Excel SN57 reads o2_cylinders row
      daily: N(r.o2_cylinders),
      mtd: sum(mtdRows, 'o2_cylinders'),
      ytd: sum(ytdRows, 'o2_cylinders')
    },
    {
      sn: "58", particulars: "O2 Consumption", uom: "Nos",
      // HLOOKUP off-by-1: Excel SN58 reads h2_cylinders row
      daily: N(r.h2_cylinders),
      mtd: sum(mtdRows, 'h2_cylinders'),
      ytd: sum(ytdRows, 'h2_cylinders')
    },
  ];

  const ashRows = [
    {
      sn: "59", particulars: "Ash Generation", uom: "MT",
      daily: r.dAshTotalMt,
      mtd: sum(mtdRows, 'dAshTotalMt'),
      ytd: sum(ytdRows, 'dAshTotalMt')
    },
    {
      sn: "60", particulars: "Fly Ash Generation", uom: "MT",
      daily: r.dFlyAshMt,
      mtd: sum(mtdRows, 'dFlyAshMt'),
      ytd: sum(ytdRows, 'dFlyAshMt')
    },
    {
      sn: "61", particulars: "Fly Ash to Cement Plant", uom: "MT",
      daily: N(r.chem_ash_sales_mt),
      mtd: sum(mtdRows, 'chem_ash_sales_mt'),
      ytd: sum(ytdRows, 'chem_ash_sales_mt')
    },
    {
      sn: "62", particulars: "Fly Ash to Ash Dyke", uom: "MT",
      daily: N(r.fa_to_ash_pond_mt),
      mtd: sum(mtdRows, 'fa_to_ash_pond_mt'),
      ytd: sum(ytdRows, 'fa_to_ash_pond_mt')
    },
    {
      sn: "63", particulars: "Fly Ash Silo Level", uom: "%",
      daily: N(r.fa_silo_lvl_pct), mtd: null, ytd: null
    },
    {
      sn: "64", particulars: "Fly Ash Sale", uom: "MT",
      daily: N(r.chem_ash_sales_mt),
      mtd: sum(mtdRows, 'chem_ash_sales_mt'),
      ytd: sum(ytdRows, 'chem_ash_sales_mt')
    },
    {
      sn: "65", particulars: "Fly Ash Trucks", uom: "No's",
      daily: N(r.fa_trucks),
      mtd: sum(mtdRows, 'fa_trucks'),
      ytd: sum(ytdRows, 'fa_trucks')
    },
    {
      sn: "66", particulars: "Bottom Ash Generation", uom: "MT",
      daily: r.dBottomAshMt,
      mtd: sum(mtdRows, 'dBottomAshMt'),
      ytd: sum(ytdRows, 'dBottomAshMt')
    },
    {
      sn: "67", particulars: "Bottom Ash Trucks (Internal)", uom: "No's",
      daily: N(r.ba_trucks_internal),
      mtd: sum(mtdRows, 'ba_trucks_internal'),
      ytd: sum(ytdRows, 'ba_trucks_internal')
    },
    {
      sn: "68", particulars: "Bottom Ash Trucks (External)", uom: "No's",
      daily: N(r.ba_trucks_external),
      mtd: sum(mtdRows, 'ba_trucks_external'),
      ytd: sum(ytdRows, 'ba_trucks_external')
    },
    {
      sn: "69", particulars: "Bottom Ash Disposal", uom: "No's",
      daily: N(r.ba_trucks_internal) + N(r.ba_trucks_external),
      mtd: sum(mtdRows, 'ba_trucks_internal') + sum(mtdRows, 'ba_trucks_external'),
      ytd: sum(ytdRows, 'ba_trucks_internal') + sum(ytdRows, 'ba_trucks_external')
    },
  ];

  const envRows = [
    {
      sn: "70", particulars: "DSM Charges", uom: "Lac",
      daily: N(r.dsm_charges) / 100000,
      mtd: sum(mtdRows, 'dsm_charges') / 100000,
      ytd: sum(ytdRows, 'dsm_charges') / 100000
    },
    {
      sn: "71", particulars: "Net Gain / Loss", uom: "₹ Lac",
      daily: N(r.net_gain_loss),
      mtd: sum(mtdRows, 'net_gain_loss'),
      ytd: sum(ytdRows, 'net_gain_loss')
    },
    {
      sn: "72", particulars: "Fuel Saved / Loss", uom: "MT",
      daily: N(r.fuel_saved_loss),
      mtd: sum(mtdRows, 'fuel_saved_loss'),
      ytd: sum(ytdRows, 'fuel_saved_loss')
    },
    {
      sn: "73", particulars: "Scheduled Generation Revision", uom: "No's",
      daily: N(r.no_load_backdown_inst),
      mtd: sum(mtdRows, 'no_load_backdown_inst'),
      ytd: sum(ytdRows, 'no_load_backdown_inst')
    },
    {
      sn: "74", particulars: "Remarks - if any", uom: "text",
      daily: r.remarks || '—', mtd: null, ytd: null
    },
    {
      sn: "75", particulars: "Grid Disturbance", uom: "text",
      daily: r.grid_disturbance || '—', mtd: null, ytd: null
    },
    {
      sn: "76", particulars: "Grid Frequency (Max / Min)", uom: "Hz",
      daily: `${N(r.grid_freq_max)} / ${N(r.grid_freq_min)}`, mtd: null, ytd: null
    },
    {
      sn: "77", particulars: "Ambient Temperature (Max / Min)", uom: "°C",
      daily: `${N(r.ambient_temp_max)} / ${N(r.ambient_temp_min)}`, mtd: null, ytd: null
    },
    {
      sn: "78", particulars: "Relative Humidity (Max / Min)", uom: "%",
      daily: `${N(r.humidity_max)} / ${N(r.humidity_min)}`, mtd: null, ytd: null
    },
    {
      sn: "79", particulars: "Day Highlights", uom: "text",
      daily: r.day_highlights || '—', mtd: null, ytd: null
    },
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
