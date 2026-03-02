// services/data-entry/src/controllers/scada.controller.js
const multer  = require('multer');
const csvParse= require('csv-parse/sync');
const XLSX    = require('xlsx');
const { query, transaction } = require('../shared/db');
const { success, error, created } = require('../shared/response');
const logger  = require('../shared/logger');

// ── Multer — memory storage (no disk) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowed.includes(file.mimetype) ||
        file.originalname.match(/\.(csv|xls|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLS, XLSX files are allowed'));
    }
  },
}).single('scadaFile');

// ── Parse uploaded file into array of row objects ──
function parseFile(buffer, mimetype, originalname) {
  if (originalname.match(/\.csv$/i)) {
    return csvParse.parse(buffer.toString('utf8'), {
      columns: true, skip_empty_lines: true, trim: true,
    });
  } else {
    const wb   = XLSX.read(buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
  }
}

// ── GET /api/data-entry/scada/mappings/:plantId ──
exports.getMappings = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, scada_column, portal_field, transform_formula, is_active
       FROM scada_mappings WHERE plant_id = $1 ORDER BY scada_column`,
      [req.params.plantId]
    );
    return success(res, { mappings: rows });
  } catch (err) {
    logger.error('Get mappings error', { message: err.message });
    return error(res, 'Failed to fetch mappings', 500);
  }
};

// ── POST /api/data-entry/scada/mappings/:plantId ── (save/update mappings)
exports.saveMappings = async (req, res) => {
  try {
    const { plantId } = req.params;
    const { mappings } = req.body; // [{ scadaColumn, portalField, transformFormula }]

    await transaction(async (client) => {
      await client.query(`DELETE FROM scada_mappings WHERE plant_id = $1`, [plantId]);
      for (const m of mappings) {
        await client.query(
          `INSERT INTO scada_mappings (plant_id, scada_column, portal_field, transform_formula)
           VALUES ($1, $2, $3, $4)`,
          [plantId, m.scadaColumn, m.portalField, m.transformFormula || null]
        );
      }
    });

    return success(res, {}, 'Column mappings saved');
  } catch (err) {
    logger.error('Save mappings error', { message: err.message });
    return error(res, 'Failed to save mappings', 500);
  }
};

// ── POST /api/data-entry/scada/upload/:plantId ──
exports.uploadAndPreview = (req, res) => {
  upload(req, res, async (uploadErr) => {
    if (uploadErr) return error(res, uploadErr.message, 400);
    if (!req.file)  return error(res, 'No file uploaded', 400);

    try {
      const { plantId } = req.params;
      const { entryDate } = req.body;

      // 1. Parse file
      const rows = parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (!rows.length) return error(res, 'File is empty or could not be parsed', 400);

      // 2. Fetch saved column mappings
      const { rows: mappings } = await query(
        `SELECT scada_column, portal_field, transform_formula
         FROM scada_mappings WHERE plant_id = $1 AND is_active = TRUE`,
        [plantId]
      );

      // 3. Build mapped data — use first row (daily report = single row)
      const scadaRow   = rows[0];
      const scadaCols  = Object.keys(scadaRow);
      const mappedData = {};
      const unmapped   = [];
      const warnings   = [];

      for (const m of mappings) {
        if (scadaRow[m.scada_column] !== undefined) {
          let val = parseFloat(scadaRow[m.scada_column]) || 0;
          // Apply transform formula if present (e.g. "value / 1000 * 0.72")
          if (m.transform_formula) {
            try {
              val = eval(m.transform_formula.replace(/value/g, val));
            } catch { warnings.push(`Transform error for ${m.scada_column}`); }
          }
          mappedData[m.portal_field] = val;
        } else {
          unmapped.push({ portalField: m.portal_field, scadaColumn: m.scada_column });
        }
      }

      // 4. Detect unmapped SCADA columns
      const mappedScadaCols = mappings.map(m => m.scada_column);
      const unknownCols = scadaCols.filter(c => !mappedScadaCols.includes(c));

      // 5. Basic range validations
      const { rows: meters } = await query(
        `SELECT meter_code FROM meter_points WHERE plant_id = $1`, [plantId]
      );

      return success(res, {
        preview: {
          totalRows:   rows.length,
          mappedData,
          unmapped,
          unknownCols,
          warnings,
          rawHeaders:  scadaCols,
        },
        entryDate,
        message: unmapped.length
          ? `${unmapped.length} fields could not be mapped — please fill them manually`
          : 'All fields mapped successfully',
      });

    } catch (err) {
      logger.error('SCADA upload error', { message: err.message });
      return error(res, 'Failed to process SCADA file', 500);
    }
  });
};

// ── POST /api/data-entry/scada/confirm/:plantId ── (after operator reviews preview)
exports.confirmImport = async (req, res) => {
  try {
    const { plantId } = req.params;
    const { entryDate, mappedData, manualOverrides } = req.body;

    // Merge manual overrides into mapped data
    const finalData = { ...mappedData, ...manualOverrides };

    // Log audit entry
    await query(
      `INSERT INTO audit_log (plant_id, user_id, action, table_name, new_values)
       VALUES ($1, $2, 'SCADA_IMPORT', 'daily_power', $3)`,
      [plantId, req.user.sub, JSON.stringify({ entryDate, source: 'scada_upload' })]
    );

    return success(res, {
      plantId,
      entryDate,
      data: finalData,
      nextStep: 'Submit to /api/data-entry/power with entryMethod: "scada_upload"',
    }, 'SCADA data confirmed — ready to save');

  } catch (err) {
    logger.error('Confirm import error', { message: err.message });
    return error(res, 'Failed to confirm import', 500);
  }
};
