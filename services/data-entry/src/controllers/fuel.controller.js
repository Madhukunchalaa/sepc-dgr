// services/data-entry/src/controllers/fuel.controller.js
const { query, transaction } = require('../shared/db');
const { success, created, error, notFound } = require('../shared/response');
const logger = require('../shared/logger');

exports.getEntry = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM daily_fuel WHERE plant_id=$1 AND entry_date=$2`,
      [req.params.plantId, req.params.date]
    );
    if (!rows[0]) return notFound(res, 'Fuel entry');
    return success(res, rows[0]);
  } catch (err) { return error(res, 'Failed to fetch fuel entry', 500); }
};

exports.upsertEntry = async (req, res) => {
  try {
    const {
      plantId, entryDate,
      coalReceiptMt, coalConsMt, coalStockMt, coalGcvAr, coalGcvAf,
      ldoReceiptKl, ldoConsKl, ldoStockKl, ldoRate,
      hfoReceiptKl, hfoConsKl, hfoStockKl, hfoRate,
      h2Receipt, h2Cons, h2Stock,
      co2Receipt, co2Cons, co2Stock,
      n2Receipt, n2Cons, n2Stock,
    } = req.body;

    // SCC = coal consumed (kg) / generation (kWh)
    // SOC = (ldo cons (kl) + hfo cons (kl)) / generation (MU)
    const { rows: pw } = await query(
      `SELECT generation_mu FROM daily_power WHERE plant_id=$1 AND entry_date=$2`,
      [plantId, entryDate]
    );
    const genMu = (pw[0]?.generation_mu || 0);
    const genKwh = genMu * 1000000;
    const coalKg = (coalConsMt || 0) * 1000;

    const sccKgKwh = genKwh > 0 ? coalKg / genKwh : null;
    const socMlKwh = genMu > 0 ? ((ldoConsKl || 0) + (hfoConsKl || 0)) / genMu : null;

    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO daily_fuel (
          plant_id, entry_date,
          coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af, scc_kg_kwh,
          ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl, ldo_rate,
          hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl, hfo_rate,
          soc_ml_kwh,
          h2_receipt, h2_cons, h2_stock,
          co2_receipt, co2_cons, co2_stock,
          n2_receipt, n2_cons, n2_stock,
          submitted_by, status
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'draft'
        )
        ON CONFLICT (plant_id, entry_date) DO UPDATE SET
          coal_receipt_mt=$3, coal_cons_mt=$4, coal_stock_mt=$5, coal_gcv_ar=$6,
          coal_gcv_af=$7, scc_kg_kwh=$8,
          ldo_receipt_kl=$9, ldo_cons_kl=$10, ldo_stock_kl=$11, ldo_rate=$12,
          hfo_receipt_kl=$13, hfo_cons_kl=$14, hfo_stock_kl=$15, hfo_rate=$16,
          soc_ml_kwh=$17,
          h2_receipt=$18, h2_cons=$19, h2_stock=$20,
          co2_receipt=$21, co2_cons=$22, co2_stock=$23,
          n2_receipt=$24, n2_cons=$25, n2_stock=$26,
          updated_at=NOW()
        WHERE daily_fuel.status NOT IN ('approved','locked')
        RETURNING *`,
        [
          plantId, entryDate,
          coalReceiptMt, coalConsMt, coalStockMt, coalGcvAr, coalGcvAf, sccKgKwh,
          ldoReceiptKl, ldoConsKl, ldoStockKl, ldoRate,
          hfoReceiptKl, hfoConsKl, hfoStockKl, hfoRate,
          socMlKwh,
          h2Receipt || 0, h2Cons || 0, h2Stock || 0,
          co2Receipt || 0, co2Cons || 0, co2Stock || 0,
          n2Receipt || 0, n2Cons || 0, n2Stock || 0,
          req.user.sub,
        ]
      );
      await client.query(
        `INSERT INTO submission_status (plant_id, entry_date, module, status, submitted_by)
         VALUES ($1,$2,'fuel','draft',$3)
         ON CONFLICT (plant_id, entry_date, module) DO UPDATE SET status='draft', updated_at=NOW()`,
        [plantId, entryDate, req.user.sub]
      );
      return rows[0];
    });

    return created(res, result, 'Fuel entry saved');
  } catch (err) {
    logger.error('Upsert fuel entry error', { message: err.message });
    return error(res, 'Failed to save fuel entry', 500);
  }
};

exports.submitEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;
    await transaction(async (client) => {
      await client.query(
        `UPDATE daily_fuel SET status='submitted', submitted_by=$1, submitted_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND status='draft'`,
        [req.user.sub, plantId, entryDate]
      );
      await client.query(
        `UPDATE submission_status SET status='submitted', submitted_by=$1, submitted_at=NOW(), updated_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND module='fuel'`,
        [req.user.sub, plantId, entryDate]
      );
    });
    return success(res, {}, 'Fuel entry submitted');
  } catch (err) { return error(res, 'Submit failed', 500); }
};

exports.approveEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;
    await transaction(async (client) => {
      await client.query(
        `UPDATE daily_fuel SET status='approved', approved_by=$1, approved_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND status='submitted'`,
        [req.user.sub, plantId, entryDate]
      );
      await client.query(
        `UPDATE submission_status SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND module='fuel'`,
        [req.user.sub, plantId, entryDate]
      );
    });
    return success(res, {}, 'Fuel entry approved');
  } catch (err) { return error(res, 'Approval failed', 500); }
};
