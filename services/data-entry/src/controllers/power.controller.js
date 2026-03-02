// services/data-entry/src/controllers/power.controller.js
const { query, transaction } = require('../shared/db');
const { success, created, error, notFound } = require('../shared/response');
const logger = require('../shared/logger');

// ─────────────────────────────────────────────
// SAFE NUMBER PARSER
// ─────────────────────────────────────────────
function toNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ─────────────────────────────────────────────
// COMPUTE GENERATION
// ─────────────────────────────────────────────
async function computeGeneration(plantId, meterReadings, entryDate) {

  const { rows: meters } = await query(
    `SELECT meter_code, multiplier
     FROM meter_points
     WHERE plant_id = $1 AND is_active = TRUE
     ORDER BY sort_order`,
    [plantId]
  );

  const { rows: prevRows } = await query(
    `SELECT meter_readings
     FROM daily_power
     WHERE plant_id = $1 AND entry_date < $2::date
     ORDER BY entry_date DESC LIMIT 1`,
    [plantId, entryDate]
  );

  const prevReadings = prevRows[0]?.meter_readings || null;

  if (!prevReadings) {
    return {
      generationMU: 0, exportMU: 0, importMU: 0,
      apcMU: 0, apcPct: 0, avgLoadMW: 0, plfDaily: 0,
      generationMTD: 0, generationYTD: 0, plfMTD: 0, plfYTD: 0,
      noPrevReading: true,
    };
  }

  // ── Meter grouping (matches Excel DGR formula exactly) ──────────
  // Generation : GEN_MAIN only
  // Export     : GT_EXP_MAIN (total grid export at GT bus)
  // Import(GT) : GT_IMP_MAIN only — matches Excel DGR "Total Import (GT)"
  // AUX Import : UT_A_IMP + UT_B_IMP + BR_IMP — unit transformer imports
  //              included in APC but shown separately
  // APC = Generation - GT_Export + GT_Import (Excel formula — GT balance)
  // ───────────────────────────────────────────────────────────────
  const MAIN_GEN_CODES = ['GEN_MAIN'];
  const MAIN_EXPORT_CODES = ['GT_EXP_MAIN'];
  const MAIN_IMPORT_CODES = ['GT_IMP_MAIN'];          // GT only — matches Excel
  const AUX_IMPORT_CODES = ['UT_A_IMP', 'UT_B_IMP', 'BR_IMP'];

  const meterMap = {};
  for (const m of meters) {
    meterMap[m.meter_code] = toNumber(m.multiplier);
  }

  function calcDelta(codes) {
    let total = 0;
    for (const code of codes) {
      if (!meterMap[code]) continue;
      const today = toNumber(meterReadings?.[code]);
      const prev = toNumber(prevReadings?.[code]);
      if (today > 0 && prev > 0 && today >= prev) {
        total += (today - prev) * meterMap[code];
      }
    }
    return total;
  }

  const generationMU = calcDelta(MAIN_GEN_CODES);
  const exportMU = calcDelta(MAIN_EXPORT_CODES);
  const importMU = calcDelta(MAIN_IMPORT_CODES);   // GT_IMP_MAIN only
  const auxImportMU = calcDelta(AUX_IMPORT_CODES);    // UT-A + UT-B + BR

  // APC = Generation - GT_Export + GT_Import  (matches Excel DGR formula)
  const apcMU = generationMU - exportMU + importMU;
  const apcPct = generationMU > 0 ? apcMU / generationMU : 0;
  const avgLoadMW = (generationMU * 1000) / 24;

  // PLF = Avg Load MW / Installed Capacity MW
  const { rows: plantRows } = await query(
    `SELECT capacity_mw, plf_base_mw FROM plants WHERE id = $1`, [plantId]
  );
  const capacity_mw = toNumber(plantRows[0]?.capacity_mw || 525);
  const plfDaily = capacity_mw > 0 ? avgLoadMW / capacity_mw : 0;

  // MTD
  const { rows: mtd } = await query(
    `SELECT SUM(generation_mu) AS gen_mtd, AVG(plf_daily) AS plf_mtd
     FROM daily_power
     WHERE plant_id = $1
       AND DATE_TRUNC('month', entry_date) = DATE_TRUNC('month', $2::date)
       AND status IN ('submitted','approved','locked')`,
    [plantId, entryDate]
  );

  // YTD
  const fyStart = await getFYStart(plantId, entryDate);
  const { rows: ytd } = await query(
    `SELECT SUM(generation_mu) AS gen_ytd, AVG(plf_daily) AS plf_ytd
     FROM daily_power
     WHERE plant_id = $1
       AND entry_date >= $2::date
       AND entry_date <= $3::date
       AND status IN ('submitted','approved','locked')`,
    [plantId, fyStart, entryDate]
  );

  const genMTD_DB = toNumber(mtd[0]?.gen_mtd);
  const genYTD_DB = toNumber(ytd[0]?.gen_ytd);

  return {
    generationMU,
    exportMU,
    importMU,
    auxImportMU,
    apcMU,
    apcPct,
    avgLoadMW,
    plfDaily,
    generationMTD: genMTD_DB + generationMU,
    generationYTD: genYTD_DB + generationMU,
    plfMTD: toNumber(mtd[0]?.plf_mtd) || plfDaily,
    plfYTD: toNumber(ytd[0]?.plf_ytd) || plfDaily,
  };
}

// ─────────────────────────────────────────────
async function getFYStart(plantId, entryDate) {
  const { rows } = await query(
    `SELECT fy_start_month FROM plants WHERE id = $1`, [plantId]
  );
  const month = rows[0]?.fy_start_month || 4;
  const d = new Date(entryDate);
  const fyYear = d.getMonth() + 1 >= month ? d.getFullYear() : d.getFullYear() - 1;
  return `${fyYear}-${String(month).padStart(2, '0')}-01`;
}

// ─────────────────────────────────────────────
// GET ENTRY
// ─────────────────────────────────────────────
exports.getEntry = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT dp.*,
              u1.full_name AS submitted_by_name,
              u2.full_name AS approved_by_name
       FROM daily_power dp
       LEFT JOIN users u1 ON dp.submitted_by = u1.id
       LEFT JOIN users u2 ON dp.approved_by = u2.id
       WHERE dp.plant_id = $1 AND dp.entry_date = $2`,
      [plantId, date]
    );
    if (!rows[0]) return notFound(res, 'Power entry');
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get power entry error', { message: err.message });
    return error(res, 'Failed to fetch entry', 500);
  }
};

// ─────────────────────────────────────────────
// UPSERT ENTRY
// ─────────────────────────────────────────────
exports.upsertEntry = async (req, res) => {
  try {
    const {
      plantId, entryDate, meterReadings,
      freqMin, freqMax, freqAvg,
      hoursOnGrid, forcedOutages, plannedOutages,
      rsdCount, outageRemarks, entryMethod
    } = req.body;

    const { rows: existing } = await query(
      `SELECT status FROM daily_power WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, entryDate]
    );
    if (existing[0]?.status === 'locked') {
      return error(res, 'This entry is locked and cannot be edited', 403);
    }

    const computed = await computeGeneration(plantId, meterReadings, entryDate);

    const result = await transaction(async (client) => {
      const row = await client.query(
        `INSERT INTO daily_power (
           plant_id, entry_date, meter_readings,
           generation_mu, generation_mtd, generation_ytd,
           avg_load_mw, export_mu, import_mu,
           apc_mu, apc_pct, plf_daily, plf_mtd, plf_ytd,
           freq_min, freq_max, freq_avg, hours_on_grid,
           forced_outages, planned_outages, rsd_count,
           outage_remarks, entry_method, submitted_by, status
         ) VALUES (
           $1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
           $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'draft'
         )
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           meter_readings  = EXCLUDED.meter_readings,
           generation_mu   = EXCLUDED.generation_mu,
           generation_mtd  = EXCLUDED.generation_mtd,
           generation_ytd  = EXCLUDED.generation_ytd,
           avg_load_mw     = EXCLUDED.avg_load_mw,
           export_mu       = EXCLUDED.export_mu,
           import_mu       = EXCLUDED.import_mu,
           apc_mu          = EXCLUDED.apc_mu,
           apc_pct         = EXCLUDED.apc_pct,
           plf_daily       = EXCLUDED.plf_daily,
           plf_mtd         = EXCLUDED.plf_mtd,
           plf_ytd         = EXCLUDED.plf_ytd,
           freq_min        = EXCLUDED.freq_min,
           freq_max        = EXCLUDED.freq_max,
           freq_avg        = EXCLUDED.freq_avg,
           hours_on_grid   = EXCLUDED.hours_on_grid,
           forced_outages  = EXCLUDED.forced_outages,
           planned_outages = EXCLUDED.planned_outages,
           rsd_count       = EXCLUDED.rsd_count,
           outage_remarks  = EXCLUDED.outage_remarks,
           entry_method    = EXCLUDED.entry_method,
           updated_at      = NOW()
         WHERE daily_power.status NOT IN ('approved','locked')
         RETURNING *`,
        [
          plantId, entryDate, JSON.stringify(meterReadings),
          toNumber(computed.generationMU),
          toNumber(computed.generationMTD),
          toNumber(computed.generationYTD),
          toNumber(computed.avgLoadMW),
          toNumber(computed.exportMU),
          toNumber(computed.importMU),
          toNumber(computed.apcMU),
          toNumber(computed.apcPct),
          toNumber(computed.plfDaily),
          toNumber(computed.plfMTD),
          toNumber(computed.plfYTD),
          toNumber(freqMin), toNumber(freqMax), toNumber(freqAvg),
          toNumber(hoursOnGrid),
          toNumber(forcedOutages), toNumber(plannedOutages), toNumber(rsdCount),
          outageRemarks || null,
          entryMethod || 'manual',
          req.user.sub,
        ]
      );

      await client.query(
        `INSERT INTO submission_status (plant_id, entry_date, module, status, submitted_by)
         VALUES ($1, $2, 'power', 'draft', $3)
         ON CONFLICT (plant_id, entry_date, module)
         DO UPDATE SET status = 'draft', updated_at = NOW()`,
        [plantId, entryDate, req.user.sub]
      );

      return row.rows[0];
    });

    return created(res, { entry: result, computed }, 'Power entry saved');

  } catch (err) {
    logger.error('Upsert power entry error', { message: err.message });
    return error(res, 'Failed to save entry', 500);
  }
};

// ─────────────────────────────────────────────
// SUBMIT ENTRY
// ─────────────────────────────────────────────
exports.submitEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;

    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE daily_power
         SET status = 'submitted', submitted_by = $1,
             submitted_at = NOW(), updated_at = NOW()
         WHERE plant_id = $2 AND entry_date = $3 AND status = 'draft'
         RETURNING *`,
        [req.user.sub, plantId, entryDate]
      );
      if (!rows[0]) throw new Error('Entry not found or already submitted');

      await client.query(
        `UPDATE submission_status
         SET status = 'submitted', submitted_by = $1,
             submitted_at = NOW(), updated_at = NOW()
         WHERE plant_id = $2 AND entry_date = $3 AND module = 'power'`,
        [req.user.sub, plantId, entryDate]
      );
      return rows[0];
    });

    return success(res, result, 'Power entry submitted for approval');
  } catch (err) {
    logger.error('Submit error', { message: err.message });
    return error(res, err.message || 'Submit failed', 500);
  }
};

// ─────────────────────────────────────────────
// APPROVE ENTRY
// ─────────────────────────────────────────────
exports.approveEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;
    const allowedRoles = ['shift_in_charge', 'plant_admin', 'it_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return error(res, 'Only Shift-in-Charge can approve entries', 403);
    }

    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE daily_power
         SET status = 'approved', approved_by = $1,
             approved_at = NOW(), updated_at = NOW()
         WHERE plant_id = $2 AND entry_date = $3 AND status = 'submitted'
         RETURNING *`,
        [req.user.sub, plantId, entryDate]
      );
      if (!rows[0]) throw new Error('Entry not found or not in submitted state');

      await client.query(
        `UPDATE submission_status
         SET status = 'approved', approved_by = $1,
             approved_at = NOW(), updated_at = NOW()
         WHERE plant_id = $2 AND entry_date = $3 AND module = 'power'`,
        [req.user.sub, plantId, entryDate]
      );
      return rows[0];
    });

    return success(res, result, 'Power entry approved');
  } catch (err) {
    logger.error('Approve error', { message: err.message });
    return error(res, err.message || 'Approval failed', 500);
  }
};

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const { plantId } = req.params;
    const { from, to, limit = 30, offset = 0 } = req.query;

    const { rows } = await query(
      `SELECT entry_date, generation_mu, avg_load_mw, plf_daily,
              apc_pct, export_mu,  status, submitted_at, approved_at
       FROM daily_power
       WHERE plant_id = $1
         AND ($2::date IS NULL OR entry_date >= $2::date)
         AND ($3::date IS NULL OR entry_date <= $3::date)
       ORDER BY entry_date DESC
       LIMIT $4 OFFSET $5`,
      [plantId, from || null, to || null, limit, offset]
    );

    return success(res, { entries: rows, count: rows.length });
  } catch (err) {
    logger.error('History error', { message: err.message });
    return error(res, 'Failed to fetch history', 500);
  }
};
