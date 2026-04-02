const { query, transaction } = require('../shared/db');
const { success, created, error, notFound } = require('../shared/response');
const logger = require('../shared/logger');

exports.getEntry = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT * FROM daily_performance WHERE plant_id=$1 AND entry_date=$2`,
      [plantId, date]
    );
    if (!rows[0]) return notFound(res, 'Performance entry');
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get performance entry error', { message: err.message });
    return error(res, 'Failed to fetch performance entry', 500);
  }
};

exports.upsertEntry = async (req, res) => {
  try {
    const { plantId, date, data } = req.body;
    if (!plantId || !date || !data) {
      return error(res, 'Invalid payload', 400);
    }

    const parseNum = (val) => (val === '' || val == null ? null : Number(val));
    const gcvAr = parseNum(data.gcvAr);
    const gcvAf = parseNum(data.gcvAf);
    const ghrMtd = parseNum(data.ghrMtd);
    const ghrYtd = parseNum(data.ghrYtd);
    const loiBa = parseNum(data.loiBa);
    const loiFa = parseNum(data.loiFa);
    const fcPct = parseNum(data.fcPct);
    const vmPct = parseNum(data.vmPct);
    const millSieveA = parseNum(data.millSieveA);
    const millSieveB = parseNum(data.millSieveB);
    const millSieveC = parseNum(data.millSieveC);

    // FC/VM ratio if both are provided
    const fcVmRatio =
      fcPct !== null && vmPct !== null && vmPct !== 0
        ? fcPct / vmPct
        : null;

    // Optional direct GHR value; if not provided we persist null and let the DGR engine compute it live.
    const ghrDirect = parseNum(data.ghrDirect);
    const ghrRemarks = data.ghrRemarks === '' ? null : (data.ghrRemarks ?? null);

    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO daily_performance (
           plant_id, entry_date,
           ghr_direct, ghr_mtd, ghr_ytd,
           gcv_ar, gcv_af,
           loi_ba, loi_fa,
           fc_pct, vm_pct, fc_vm_ratio,
           mill_sieve_a, mill_sieve_b, mill_sieve_c, ghr_remarks,
           submitted_by, status
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft'
         )
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           ghr_direct    = EXCLUDED.ghr_direct,
           ghr_mtd       = EXCLUDED.ghr_mtd,
           ghr_ytd       = EXCLUDED.ghr_ytd,
           gcv_ar        = EXCLUDED.gcv_ar,
           gcv_af        = EXCLUDED.gcv_af,
           loi_ba        = EXCLUDED.loi_ba,
           loi_fa        = EXCLUDED.loi_fa,
           fc_pct        = EXCLUDED.fc_pct,
           vm_pct        = EXCLUDED.vm_pct,
           fc_vm_ratio   = EXCLUDED.fc_vm_ratio,
           mill_sieve_a  = EXCLUDED.mill_sieve_a,
           mill_sieve_b  = EXCLUDED.mill_sieve_b,
           mill_sieve_c  = EXCLUDED.mill_sieve_c,
           ghr_remarks   = EXCLUDED.ghr_remarks,
           status        = 'draft',
           updated_at    = NOW()
         WHERE daily_performance.status NOT IN ('approved','locked')
         RETURNING *`,
        [
          plantId,
          date,
          ghrDirect,
          ghrMtd,
          ghrYtd,
          gcvAr,
          gcvAf,
          loiBa,
          loiFa,
          fcPct,
          vmPct,
          fcVmRatio,
          millSieveA,
          millSieveB,
          millSieveC,
          ghrRemarks,
          req.user.sub,
        ]
      );

      await client.query(
        `INSERT INTO submission_status (plant_id, entry_date, module, status, submitted_by)
         VALUES ($1,$2,'performance','draft',$3)
         ON CONFLICT (plant_id, entry_date, module)
         DO UPDATE SET status='draft', updated_at=NOW()`,
        [plantId, date, req.user.sub]
      );

      return rows[0];
    });

    return created(res, result, 'Performance entry saved');
  } catch (err) {
    logger.error('Upsert performance entry error', { message: err.message });
    return error(res, 'Failed to save performance entry', 500);
  }
};

exports.submitEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;

    await transaction(async (client) => {
      await client.query(
        `UPDATE daily_performance
         SET status='submitted', submitted_by=$1, submitted_at=NOW(), updated_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND status='draft'`,
        [req.user.sub, plantId, entryDate]
      );

      await client.query(
        `UPDATE submission_status
         SET status='submitted', submitted_by=$1, submitted_at=NOW(), updated_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND module='performance'`,
        [req.user.sub, plantId, entryDate]
      );
    });

    return success(res, {}, 'Performance entry submitted');
  } catch (err) {
    logger.error('Submit performance entry error', { message: err.message });
    return error(res, 'Submit failed', 500);
  }
};

exports.approveEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;

    await transaction(async (client) => {
      await client.query(
        `UPDATE daily_performance
         SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND status!='approved'`,
        [req.user.sub, plantId, entryDate]
      );

      await client.query(
        `UPDATE submission_status
         SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
         WHERE plant_id=$2 AND entry_date=$3 AND module='performance'`,
        [req.user.sub, plantId, entryDate]
      );
    });

    return success(res, {}, 'Performance entry approved');
  } catch (err) {
    logger.error('Approve performance entry error', { message: err.message });
    return error(res, 'Approval failed', 500);
  }
};

exports.unlockEntry = async (req, res) => {
  try {
    const { plantId, entryDate } = req.body;
    if (!['it_admin', 'plant_admin'].includes(req.user.role)) {
      return error(res, 'Only IT Admin or Plant Admin can unlock entries', 403);
    }
    await transaction(async (client) => {
      await client.query(
        `UPDATE daily_performance SET status='draft', updated_at=NOW()
         WHERE plant_id=$1 AND entry_date=$2`,
        [plantId, entryDate]
      );
      await client.query(
        `UPDATE submission_status SET status='draft', updated_at=NOW()
         WHERE plant_id=$1 AND entry_date=$2 AND module='performance'`,
        [plantId, entryDate]
      );
    });
    return success(res, {}, 'Performance entry unlocked to draft');
  } catch (err) {
    logger.error('Unlock error', { message: err.message });
    return error(res, 'Unlock failed', 500);
  }
};

