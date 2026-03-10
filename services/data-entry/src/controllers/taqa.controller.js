// services/data-entry/src/controllers/taqa.controller.js
// Approach 1: Accepts raw Ops Input + Chem Input → calculates derived DGR metrics → writes to standard tables
const db = require('../shared/db');
const { query } = db;
const { success, created, error, notFound } = require('../shared/response');
const logger = require('../shared/logger');

const N = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; };
const N0 = (v) => N(v) ?? 0;
const CAPACITY_MW = 250;

// ─────────────────────────────────────────────────────────────────────────────
// GET ENTRY  (returns the raw taqa_daily_input for a given date)
// ─────────────────────────────────────────────────────────────────────────────
async function getEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const { rows } = await query(
            'SELECT * FROM taqa_daily_input WHERE plant_id = $1 AND entry_date = $2',
            [plantId, date]
        );
        // Return 200 with empty object when no row so frontend can always render the form and save new data
        success(res, rows[0] || {});
    } catch (err) {
        logger.error('taqa.getEntry', { message: err.message });
        error(res, 'Failed to fetch TAQA entry');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT RAW INPUT  (save raw Ops + Chem data — does NOT calculate yet)
// ─────────────────────────────────────────────────────────────────────────────
async function upsertEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const d = req.body;

        const fields = Object.keys(d).filter(k => k !== 'status');
        if (!fields.length) return error(res, 'No data provided', 400);

        const TEXT_FIELDS = ['remarks', 'day_highlights', 'grid_disturbance'];

        await db.transaction(async (client) => {
            const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
            const values = [plantId, date, ...fields.map(f => TEXT_FIELDS.includes(f) ? d[f] : N(d[f]))];

            logger.debug('taqa.upsertEntry mapping', { fieldCount: fields.length, date });

            await client.query(
                `INSERT INTO taqa_daily_input (plant_id, entry_date, ${fields.join(', ')})
           VALUES ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(', ')})
           ON CONFLICT (plant_id, entry_date) DO UPDATE SET
             ${setClauses}, updated_at = NOW()`,
                values
            );

            // Also update submission_status as draft for all TAQA sub-modules
            // Note: 'ash' is not in the submission_status_module_check constraint, so we exclude it.
            const modules = ['power', 'fuel', 'performance', 'availability', 'scheduling', 'water'];
            for (const m of modules) {
                await client.query(
                    `INSERT INTO submission_status (plant_id, entry_date, module, status, submitted_by)
             VALUES ($1, $2, $3, 'draft', $4)
             ON CONFLICT (plant_id, entry_date, module) DO UPDATE SET status = 'draft', updated_at = NOW()`,
                    [plantId, date, m, req.user?.sub]
                );
            }
        });

        success(res, { message: 'TAQA entry saved as draft', date });
    } catch (err) {
        logger.error('taqa.upsertEntry', { message: err.message, stack: err.stack, detail: err.detail });
        error(res, 'Failed to save TAQA entry: ' + err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATE & SUBMIT  (derives DGR metrics → writes to standard tables)
// ─────────────────────────────────────────────────────────────────────────────
async function submitEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const userId = req.user?.sub;

        // 1. Fetch the raw input
        const { rows } = await query(
            'SELECT * FROM taqa_daily_input WHERE plant_id = $1 AND entry_date = $2',
            [plantId, date]
        );
        if (!rows.length) return notFound(res, 'No TAQA entry found. Save data first.');
        const r = rows[0];

        // ── 2. DERIVE CALCULATED METRICS (mirrors Excel 'DGR' sheet formulas) ──

        // Generation  (Main Meter MWhr → MU)
        const grossGenMu = N0(r.gen_main_meter) / 1000;
        const netExportMu = N0(r.net_export) / 1000;
        const netImportMu = N0(r.net_import_sy) / 1000;
        const auxMu = grossGenMu - netExportMu + netImportMu;
        const apcPct = grossGenMu > 0 ? (auxMu / grossGenMu) : 0;
        const plfDaily = (CAPACITY_MW * 24 / 1000) > 0 ? grossGenMu / (CAPACITY_MW * 24 / 1000) : 0;

        // Scheduling / Dispatch
        const dcMu = N0(r.declared_capacity_mwhr) / 1000;
        const deemedGenMu = N0(r.deemed_gen_mwhr) / 1000;
        const dispatchDemandMu = N0(r.dispatch_demand_mwhr) / 1000;
        const scheduleMu = N0(r.schedule_gen_mldc) / 1000;
        const pafPct = (CAPACITY_MW * 24 / 1000) > 0 ? dcMu / (CAPACITY_MW * 24 / 1000) : 0;

        // Grid hours  (dispatch_duration is hrs on grid)
        const hoursOnGrid = N0(r.dispatch_duration);

        // HFO Consumption (Supply - Return integrators, convert Litres → KL → MT)
        // If both integrator readings exist, use the difference. Otherwise use 0.
        const hfoSupplyL = N0(r.hfo_supply_int_rdg);
        const hfoReturnL = N0(r.hfo_return_int_rdg);
        const hfoConsKl = (hfoSupplyL - hfoReturnL) / 1000;   // Litres → KL
        const hfoConsMt = hfoConsKl * 0.945;                    // KL → MT (density)

        // HSD Consumption (T-30 receipt = proxy for consumption since no return meter)
        const hsdConsKl = N0(r.hsd_t30_receipt_kl) + N0(r.hsd_t40_receipt_kl);

        // Lignite Consumption (Conveyor 1A + 1B load cell difference from previous day)
        // For simplicity we use the receipt from WB as the daily consumption proxy
        const ligniteMt = N0(r.lignite_receipt_taqa_wb);

        // GCV from Chem Input
        const gcvAf = N0(r.chem_gcv_nlcil);

        // Ash from Chem Input
        const ashGenMt = (ligniteMt * N0(r.chem_ash_pct)) / 100;
        const ashSalesMt = N0(r.chem_ash_sales_mt);

        // Water
        const dmProdM3 = N0(r.dm_water_prod_m3);
        const dmCstM3 = N0(r.cst_to_main_unit);
        const totalWaterM3 = N0(r.service_water_flow) + N0(r.potable_tank_makeup) + N0(r.raw_water_to_dm);

        // ── 3. WRITE TO STANDARD DGR TABLES (inside a transaction) ──
        await db.transaction(async (client) => {
            // daily_power
            await client.query(
                `INSERT INTO daily_power
           (plant_id, entry_date, generation_mu, export_mu, import_mu, apc_pct, plf_daily, hours_on_grid, meter_readings, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           generation_mu=$3, export_mu=$4, import_mu=$5, apc_pct=$6, plf_daily=$7, hours_on_grid=$8, meter_readings=$9, status='submitted'`,
                [plantId, date, grossGenMu, netExportMu, netImportMu, apcPct, plfDaily, hoursOnGrid, null]
            );

            // daily_fuel (lignite → coal_cons_mt)
            await client.query(
                `INSERT INTO daily_fuel (plant_id, entry_date, coal_cons_mt, hfo_cons_kl, ldo_cons_kl, coal_gcv_af, status)
         VALUES ($1,$2,$3,$4,$5,$6,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           coal_cons_mt=$3, hfo_cons_kl=$4, ldo_cons_kl=$5, coal_gcv_af=$6, status='submitted'`,
                [plantId, date, ligniteMt, hfoConsKl, hsdConsKl, gcvAf]
            );

            // daily_performance (GCV)
            await client.query(
                `INSERT INTO daily_performance (plant_id, entry_date, gcv_af, status)
         VALUES ($1,$2,$3,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET gcv_af=$3, status='submitted'`,
                [plantId, date, gcvAf]
            );

            // daily_availability
            await client.query(
                `INSERT INTO daily_availability (plant_id, entry_date, paf_pct, status)
         VALUES ($1,$2,$3,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET paf_pct=$3, status='submitted'`,
                [plantId, date, pafPct]
            );

            // daily_scheduling
            await client.query(
                `INSERT INTO daily_scheduling (plant_id, entry_date, dc_sepc_mu, sg_ppa_mu, deemed_gen_mu, sg_rtm_mu, status)
         VALUES ($1,$2,$3,$4,$5,$6,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           dc_sepc_mu=$3, sg_ppa_mu=$4, deemed_gen_mu=$5, sg_rtm_mu=$6, status='submitted'`,
                [plantId, date, dcMu, scheduleMu, deemedGenMu, dispatchDemandMu]
            );

            // daily_water
            await client.query(
                `INSERT INTO daily_water (plant_id, entry_date, dm_generation_m3, dm_total_cons_m3, sea_water_m3, status)
         VALUES ($1,$2,$3,$4,$5,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           dm_generation_m3=$3, dm_total_cons_m3=$4, sea_water_m3=$5, status='submitted'`,
                [plantId, date, dmProdM3, dmCstM3, totalWaterM3]
            );

            // daily_ash
            await client.query(
                `INSERT INTO daily_ash (plant_id, entry_date, fa_generated_mt, fa_to_user_mt, status)
         VALUES ($1,$2,$3,$4,'submitted')
         ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           fa_generated_mt=$3, fa_to_user_mt=$4, status='submitted'`,
                [plantId, date, ashGenMt, ashSalesMt]
            );

            // Mark taqa_daily_input as submitted
            await client.query(
                `UPDATE taqa_daily_input SET status='submitted', submitted_by=$3, submitted_at=NOW()
         WHERE plant_id=$1 AND entry_date=$2`,
                [plantId, date, userId]
            );

            // Update submission_status for all modules
            const modules = ['power', 'fuel', 'performance', 'availability', 'scheduling', 'water', 'ash'];
            for (const m of modules) {
                await client.query(
                    `UPDATE submission_status SET status='submitted', submitted_by=$1, submitted_at=NOW(), updated_at=NOW()
             WHERE plant_id=$2 AND entry_date=$3 AND module=$4`,
                    [userId, plantId, date, m]
                );
            }
        });

        logger.info('TAQA entry submitted & derived metrics written', { plantId, date });
        success(res, {
            message: 'TAQA entry submitted successfully. DGR metrics calculated.',
            derivedMetrics: {
                grossGenMu: grossGenMu.toFixed(4),
                netExportMu: netExportMu.toFixed(4),
                apcPct: (apcPct * 100).toFixed(2) + '%',
                plfDaily: (plfDaily * 100).toFixed(2) + '%',
                pafPct: (pafPct * 100).toFixed(2) + '%',
                dcMu: dcMu.toFixed(4),
                hfoConsKl: hfoConsKl.toFixed(3),
                ligniteMt: ligniteMt.toFixed(3),
                gcvAf,
                ashGenMt: ashGenMt.toFixed(3),
            }
        });
    } catch (err) {
        logger.error('taqa.submitEntry', { message: err.message, stack: err.stack, detail: err.detail });
        error(res, 'Failed to submit TAQA entry: ' + err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE  (approves all linked DGR table records)
// ─────────────────────────────────────────────────────────────────────────────
async function approveEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const userId = req.user?.sub;
        const tables = ['daily_power', 'daily_fuel', 'daily_performance', 'daily_availability',
            'daily_scheduling', 'daily_water', 'daily_ash'];
        await db.transaction(async (client) => {
            for (const t of tables) {
                await client.query(
                    `UPDATE ${t} SET status='approved' WHERE plant_id=$1 AND entry_date=$2`,
                    [plantId, date]
                );
            }
            await client.query(
                `UPDATE taqa_daily_input SET status='approved', approved_by=$3, approved_at=NOW()
         WHERE plant_id=$1 AND entry_date=$2`,
                [plantId, date, userId]
            );

            // Update submission_status for all modules
            const modules = ['power', 'fuel', 'performance', 'availability', 'scheduling', 'water', 'ash'];
            for (const m of modules) {
                await client.query(
                    `UPDATE submission_status SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
             WHERE plant_id=$2 AND entry_date=$3 AND module=$4`,
                    [userId, plantId, date, m]
                );
            }
        });
        success(res, { message: 'TAQA entry approved' });
    } catch (err) {
        logger.error('taqa.approveEntry', { message: err.message, stack: err.stack, detail: err.detail });
        error(res, 'Failed to approve TAQA entry: ' + err.message);
    }
}

module.exports = { getEntry, upsertEntry, submitEntry, approveEntry };
