// services/data-entry/src/controllers/sepc-excel.controller.js
// Parses SEPC TTPP DGR Excel (FY 2025-26 format) and saves all modules in one transaction
// Handles: Power, Fuel & Ash, Perf, Water, Availability, DC-SG, Activities sheets

const multer = require('multer');
const XLSX   = require('xlsx');
const { query, transaction } = require('../shared/db');
const { success, error }     = require('../shared/response');
const logger                 = require('../shared/logger');

// ── Multer ──────────────────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.originalname.match(/\.(xls|xlsx|xlsm)$/i)) cb(null, true);
        else cb(new Error('Only Excel files (.xls .xlsx .xlsm) are accepted'));
    },
}).single('dgrFile');

// ── Helpers ──────────────────────────────────────────────────────────────────
const N = (v) => {
    if (v == null || v === '' || String(v).toLowerCase().includes('faulty')) return null;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? null : n;
};

// Match cell value to ISO date "YYYY-MM-DD"
// Handles: "Tuesday, April 01, 2025", "4/1/25", "2025-04-01", Date objects
function matchDate(cellVal, targetISO) {
    if (cellVal == null) return false;
    if (cellVal instanceof Date) {
        const y = cellVal.getFullYear();
        const m = String(cellVal.getMonth() + 1).padStart(2, '0');
        const d = String(cellVal.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === targetISO;
    }
    const s = String(cellVal).trim();
    if (!s) return false;
    // Try native Date parse (handles "Tuesday, April 01, 2025" and ISO)
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === targetISO;
    }
    // Handle "4/1/25" short format (M/D/YY)
    const shortMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (shortMatch) {
        const mo = shortMatch[1].padStart(2, '0');
        const dy = shortMatch[2].padStart(2, '0');
        let yr = parseInt(shortMatch[3]);
        if (yr < 100) yr += 2000;
        return `${yr}-${mo}-${dy}` === targetISO;
    }
    return false;
}

// Parse "24:00" or "1 Days, 0 Hrs, 30 Mins" → decimal hours
function parseHours(v) {
    if (!v) return null;
    const s = String(v).trim();
    const hm = s.match(/^(\d+):(\d+)$/);
    if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
    const days = Number(s.match(/(\d+)\s*Day/i)?.[1] || 0);
    const hrs  = Number(s.match(/(\d+)\s*Hr/i)?.[1]  || 0);
    const mins = Number(s.match(/(\d+)\s*Min/i)?.[1] || 0);
    return days * 24 + hrs + mins / 60;
}

// Parse "100.00%" or 1.0 → fraction (0-1)
function parsePct(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (s.includes('%')) return parseFloat(s) / 100;
    const n = parseFloat(s);
    return isNaN(n) ? null : (n > 1 ? n / 100 : n);
}

// Find row matching targetISO date; col 0 is the date column
function findDateRow(rows, headerCount, targetISO) {
    for (let i = headerCount; i < rows.length; i++) {
        if (matchDate(rows[i][0], targetISO)) return { row: rows[i], idx: i };
    }
    return null;
}

// ── Column map constants (0-indexed) ─────────────────────────────────────────
// Power sheet — data starts row index 7
const P = {
    GEN_MAIN:     1,   // MF = 0.72 → delta × 0.72 = MU
    GEN_CHECK:    2,
    GT_IMP_MAIN:  3,   // MF = 3.6
    GT_EXP_MAIN:  4,
};

// Fuel & Ash sheet — data starts row index 6
const F = {
    LDO_RECEIPT:       1,
    LDO_CONS:          7,
    LDO_STOCK:        10,
    HFO_RECEIPT_KL:   12,
    HFO_CONS_KL:      18,
    HFO_STOCK_KL:     21,
    COAL_RECEIPT:     25,
    COAL_CONS:        28,
    COAL_STOCK:       31,
    H2_CONS:          35,
    H2_RECEIPT:       38,
    H2_STOCK:         39,
    CO2_CONS:         40,
    CO2_RECEIPT:      43,
    CO2_STOCK:        44,
    N2_CONS:          45,
    N2_RECEIPT:       48,
    N2_STOCK:         49,
    FA_GENERATED:     53,  // Fly Ash + APH + Duct generated
    BA_GENERATED:     56,  // Bottom + Eco Ash generated
    FA_TO_USER:       59,  // Fly Ash Utilized (to user)
    FA_TO_DYKE:       62,
    BA_TO_USER:       65,
    BA_TO_DYKE:       68,
};

// Perf sheet — data starts row index 6
const PERF = {
    GCV_AR:    1,
    GCV_AF:    5,
    GHR:       9,
    GHR_REM:  14,
};

// Water sheet — data starts row index 6
const W = {
    DM_GEN:         1,
    DM_TOTAL_CONS:  4,
    DM_STOCK:       7,
    DM_CYCLE_MKUP:  8,
    SW_GEN:        17,   // Service Water Generation → filtered_water_gen_m3
    SW_CONS:       20,   // Service Water Consumption → service_water_m3
    SW_STOCK:      23,   // FW/FF Stock → service_water_stock_m3
    CT_MAKEUP:     24,   // CT Make Up Sea Water → idct_makeup_m3
    OUTFALL:       33,
    SEA_INTAKE:    42,   // Sea Water Intake → sea_water_m3
    SWI_FLOW:      45,   // DM Plant Sea Water Inlet → swi_flow_m3
    POTABLE:       56,
};

// Availability sheet — data starts row index 4
const AV = {
    PAF_PCT:          4,
    RUNNING_HRS:     10,
    PLANNED_HRS:     13,
    PLANNED_PCT:     16,
    FORCED_HRS:      19,
    FORCED_PCT:      22,
    RSD_HRS:         25,
    RSD_PCT:         28,
};

// DC-SG sheet — data starts row index 3
const DC = {
    DC_MU:     1,   // Declared Capacity (TNPDCL)
    TOTAL_SG:  2,   // Total SG Daily
    RTM:       9,   // RTM Cleared Daily
    DAM:      16,   // DAM Cleared Daily
};

// Activities sheet — data starts row index 2
const ACT = {
    ACTIVITIES:   1,
    RUNNING_EQUIP: 2,
    OUTAGE:        3,
};

// ── Main controller ───────────────────────────────────────────────────────────
exports.uploadAndSave = (req, res) => {
    upload(req, res, async (uploadErr) => {
        if (uploadErr) return error(res, uploadErr.message, 400);
        if (!req.file)  return error(res, 'No file uploaded', 400);

        const { plantId }   = req.params;
        const { entryDate, previewOnly } = req.body;
        if (!entryDate) return error(res, 'entryDate is required', 400);

        try {
            const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true, raw: false });

            const toRows = (sheetName) => {
                const ws = wb.Sheets[sheetName];
                return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) : [];
            };

            const powerRows = toRows('Power');
            const fuelRows  = toRows('Fuel & Ash');
            const perfRows  = toRows('Perf');
            const waterRows = toRows('Water');
            const availRows = toRows('Availability');
            const dcSgRows  = toRows('DC-SG');
            const activRows = toRows('Activities');

            // ── Extract each sheet ──────────────────────────────────────────
            // Power — compute generation from cumulative meter deltas
            const powerFound = findDateRow(powerRows, 7, entryDate);
            let powerData = {};
            if (powerFound) {
                const cur  = powerFound.row;
                const prev = powerFound.idx > 7 ? powerRows[powerFound.idx - 1] : powerRows[6]; // fall back to initial row

                const dGen = Math.max(0, (N(cur[P.GEN_MAIN])    ?? 0) - (N(prev[P.GEN_MAIN])    ?? 0));
                const dExp = Math.max(0, (N(cur[P.GT_EXP_MAIN]) ?? 0) - (N(prev[P.GT_EXP_MAIN]) ?? 0));
                const dImp = Math.max(0, (N(cur[P.GT_IMP_MAIN]) ?? 0) - (N(prev[P.GT_IMP_MAIN]) ?? 0));

                const genMU = dGen * 0.72;
                const expMU = dExp * 3.6;
                const impMU = dImp * 3.6;
                const apcMU = Math.max(0, genMU - expMU + impMU);

                powerData = {
                    generation_mu: genMU,
                    export_mu:     expMU,
                    import_mu:     impMU,
                    apc_mu:        apcMU,
                    apc_pct:       genMU > 0 ? apcMU / genMU : 0,
                    meter_readings: {
                        GEN_MAIN:    cur[P.GEN_MAIN],
                        GEN_CHECK:   cur[P.GEN_CHECK],
                        GT_EXP_MAIN: cur[P.GT_EXP_MAIN],
                        GT_IMP_MAIN: cur[P.GT_IMP_MAIN],
                    },
                };
            }

            // Fuel & Ash
            const fuelFound = findDateRow(fuelRows, 6, entryDate);
            let fuelData = {}, ashData = {};
            if (fuelFound) {
                const fr = fuelFound.row;
                fuelData = {
                    ldo_receipt_kl:  N(fr[F.LDO_RECEIPT]),
                    ldo_cons_kl:     N(fr[F.LDO_CONS]),
                    ldo_stock_kl:    N(fr[F.LDO_STOCK]),
                    hfo_receipt_kl:  N(fr[F.HFO_RECEIPT_KL]),
                    hfo_cons_kl:     N(fr[F.HFO_CONS_KL]),
                    hfo_stock_kl:    N(fr[F.HFO_STOCK_KL]),
                    coal_receipt_mt: N(fr[F.COAL_RECEIPT]),
                    coal_cons_mt:    N(fr[F.COAL_CONS]),
                    coal_stock_mt:   N(fr[F.COAL_STOCK]),
                    h2_cons:         N(fr[F.H2_CONS]),
                    h2_receipt:      N(fr[F.H2_RECEIPT]),
                    h2_stock:        N(fr[F.H2_STOCK]),
                    co2_cons:        N(fr[F.CO2_CONS]),
                    co2_receipt:     N(fr[F.CO2_RECEIPT]),
                    co2_stock:       N(fr[F.CO2_STOCK]),
                    n2_cons:         N(fr[F.N2_CONS]),
                    n2_receipt:      N(fr[F.N2_RECEIPT]),
                    n2_stock:        N(fr[F.N2_STOCK]),
                };
                ashData = {
                    fa_generated_mt: N(fr[F.FA_GENERATED]),
                    ba_generated_mt: N(fr[F.BA_GENERATED]),
                    fa_to_user_mt:   N(fr[F.FA_TO_USER]),
                    fa_to_dyke_mt:   N(fr[F.FA_TO_DYKE]),
                    ba_to_user_mt:   N(fr[F.BA_TO_USER]),
                    ba_to_dyke_mt:   N(fr[F.BA_TO_DYKE]),
                };
            }

            // Perf
            const perfFound = findDateRow(perfRows, 6, entryDate);
            let perfData = {};
            if (perfFound) {
                const pr = perfFound.row;
                perfData = {
                    coal_gcv_ar: N(pr[PERF.GCV_AR]),
                    coal_gcv_af: N(pr[PERF.GCV_AF]),
                    ghr_direct:  N(pr[PERF.GHR]),
                    ghr_remarks: pr[PERF.GHR_REM] || null,
                };
                // Merge GCV into fuel
                fuelData.coal_gcv_ar = fuelData.coal_gcv_ar ?? perfData.coal_gcv_ar;
                fuelData.coal_gcv_af = fuelData.coal_gcv_af ?? perfData.coal_gcv_af;
            }

            // Water
            const waterFound = findDateRow(waterRows, 6, entryDate);
            let waterData = {};
            if (waterFound) {
                const wr = waterFound.row;
                waterData = {
                    dm_generation_m3:     N(wr[W.DM_GEN]),
                    dm_total_cons_m3:     N(wr[W.DM_TOTAL_CONS]),
                    dm_stock_m3:          N(wr[W.DM_STOCK]),
                    dm_cycle_makeup_m3:   N(wr[W.DM_CYCLE_MKUP]),
                    filtered_water_gen_m3: N(wr[W.SW_GEN]),
                    service_water_m3:     N(wr[W.SW_CONS]),
                    service_water_stock_m3: N(wr[W.SW_STOCK]),
                    idct_makeup_m3:       N(wr[W.CT_MAKEUP]),
                    outfall_m3:           N(wr[W.OUTFALL]),
                    sea_water_m3:         N(wr[W.SEA_INTAKE]),
                    swi_flow_m3:          N(wr[W.SWI_FLOW]),
                    potable_water_m3:     N(wr[W.POTABLE]),
                };
            }

            // Availability
            const availFound = findDateRow(availRows, 4, entryDate);
            let availData = {};
            if (availFound) {
                const ar = availFound.row;
                const pafPct = parsePct(ar[AV.PAF_PCT]);
                availData = {
                    paf_pct:           pafPct,
                    paf_tnpdcl:        pafPct,
                    hours_on_grid:     parseHours(ar[AV.RUNNING_HRS]),
                    planned_outage_hrs: parseHours(ar[AV.PLANNED_HRS]),
                    forced_outage_hrs:  parseHours(ar[AV.FORCED_HRS]),
                    rsd_hrs:            parseHours(ar[AV.RSD_HRS]),
                };
                // Patch hours_on_grid into power
                if (powerData && !powerData.hours_on_grid) {
                    powerData.hours_on_grid = availData.hours_on_grid;
                }
            }

            // DC-SG scheduling
            const dcSgFound = findDateRow(dcSgRows, 3, entryDate);
            let schedulingData = {};
            if (dcSgFound) {
                const dr = dcSgFound.row;
                const dcMu      = N(dr[DC.DC_MU]);
                const totalSgMu = N(dr[DC.TOTAL_SG]);
                const rtmMu     = N(dr[DC.RTM]);
                const damMu     = N(dr[DC.DAM]);
                const ppaMu     = totalSgMu != null
                    ? Math.max(0, totalSgMu - (rtmMu || 0) - (damMu || 0))
                    : null;
                schedulingData = {
                    dc_tnpdcl_mu: dcMu,
                    dc_sepc_mu:   dcMu,
                    sg_ppa_mu:    ppaMu,
                    sg_rtm_mu:    rtmMu,
                    sg_dam_mu:    damMu,
                };
            }

            // Activities
            const activFound = findDateRow(activRows, 2, entryDate);
            let activData = {};
            if (activFound) {
                const ar = activFound.row;
                activData = {
                    activities:       ar[ACT.ACTIVITIES]    || null,
                    running_equipment: ar[ACT.RUNNING_EQUIP] || null,
                    outage_remarks:    ar[ACT.OUTAGE]        || null,
                };
            }

            // ── Sheet found summary ─────────────────────────────────────────
            const sheetsFound = {
                Power:        !!powerFound,
                'Fuel & Ash': !!fuelFound,
                Perf:         !!perfFound,
                Water:        !!waterFound,
                Availability: !!availFound,
                'DC-SG':      !!dcSgFound,
                Activities:   !!activFound,
            };

            const extracted = { powerData, fuelData, perfData, waterData, availData, schedulingData, activData, ashData, sheetsFound };

            if (previewOnly === 'true' || previewOnly === true) {
                return success(res, { preview: extracted, entryDate });
            }

            // ── Save all modules in one DB transaction ──────────────────────
            const userId = req.user?.sub;

            await transaction(async (client) => {
                // 1. daily_power
                if (powerData.generation_mu != null) {
                    const plf = powerData.generation_mu / ((525 * 24) / 1000);
                    await client.query(`
                        INSERT INTO daily_power
                          (plant_id, entry_date, generation_mu, export_mu, import_mu, apc_mu, apc_pct, plf_daily, hours_on_grid, meter_readings, status)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'submitted')
                        ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                          generation_mu=$3, export_mu=$4, import_mu=$5, apc_mu=$6, apc_pct=$7, plf_daily=$8,
                          hours_on_grid=$9, meter_readings=$10, status='submitted', updated_at=NOW()`,
                        [plantId, entryDate,
                         powerData.generation_mu, powerData.export_mu, powerData.import_mu,
                         powerData.apc_mu, powerData.apc_pct, plf,
                         powerData.hours_on_grid, JSON.stringify(powerData.meter_readings)]
                    );
                }

                // 2. daily_fuel
                await client.query(`
                    INSERT INTO daily_fuel
                      (plant_id, entry_date, ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
                       hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl,
                       coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af,
                       h2_cons, h2_receipt, h2_stock,
                       co2_cons, co2_receipt, co2_stock,
                       n2_cons, n2_receipt, n2_stock, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'submitted')
                    ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                      ldo_receipt_kl=$3, ldo_cons_kl=$4, ldo_stock_kl=$5,
                      hfo_receipt_kl=$6, hfo_cons_kl=$7, hfo_stock_kl=$8,
                      coal_receipt_mt=$9, coal_cons_mt=$10, coal_stock_mt=$11, coal_gcv_ar=$12, coal_gcv_af=$13,
                      h2_cons=$14, h2_receipt=$15, h2_stock=$16,
                      co2_cons=$17, co2_receipt=$18, co2_stock=$19,
                      n2_cons=$20, n2_receipt=$21, n2_stock=$22,
                      status='submitted', updated_at=NOW()`,
                    [plantId, entryDate,
                     fuelData.ldo_receipt_kl, fuelData.ldo_cons_kl, fuelData.ldo_stock_kl,
                     fuelData.hfo_receipt_kl, fuelData.hfo_cons_kl, fuelData.hfo_stock_kl,
                     fuelData.coal_receipt_mt, fuelData.coal_cons_mt, fuelData.coal_stock_mt,
                     fuelData.coal_gcv_ar, fuelData.coal_gcv_af,
                     fuelData.h2_cons, fuelData.h2_receipt, fuelData.h2_stock,
                     fuelData.co2_cons, fuelData.co2_receipt, fuelData.co2_stock,
                     fuelData.n2_cons, fuelData.n2_receipt, fuelData.n2_stock]
                );

                // 3. daily_performance
                if (perfData.coal_gcv_af || perfData.ghr_direct) {
                    await client.query(`
                        INSERT INTO daily_performance (plant_id, entry_date, gcv_af, ghr_direct, ghr_remarks, status)
                        VALUES ($1,$2,$3,$4,$5,'submitted')
                        ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                          gcv_af=$3, ghr_direct=$4, ghr_remarks=$5, status='submitted', updated_at=NOW()`,
                        [plantId, entryDate, perfData.coal_gcv_af, perfData.ghr_direct, perfData.ghr_remarks]
                    );
                }

                // 4. daily_water
                await client.query(`
                    INSERT INTO daily_water
                      (plant_id, entry_date, dm_generation_m3, dm_total_cons_m3, dm_stock_m3,
                       dm_cycle_makeup_m3, filtered_water_gen_m3, service_water_m3, service_water_stock_m3,
                       idct_makeup_m3, outfall_m3, sea_water_m3, swi_flow_m3, potable_water_m3, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'submitted')
                    ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                      dm_generation_m3=$3, dm_total_cons_m3=$4, dm_stock_m3=$5,
                      dm_cycle_makeup_m3=$6, filtered_water_gen_m3=$7, service_water_m3=$8, service_water_stock_m3=$9,
                      idct_makeup_m3=$10, outfall_m3=$11, sea_water_m3=$12, swi_flow_m3=$13, potable_water_m3=$14,
                      status='submitted', updated_at=NOW()`,
                    [plantId, entryDate,
                     waterData.dm_generation_m3, waterData.dm_total_cons_m3, waterData.dm_stock_m3,
                     waterData.dm_cycle_makeup_m3, waterData.filtered_water_gen_m3, waterData.service_water_m3,
                     waterData.service_water_stock_m3, waterData.idct_makeup_m3, waterData.outfall_m3,
                     waterData.sea_water_m3, waterData.swi_flow_m3, waterData.potable_water_m3]
                );

                // 5. daily_availability
                await client.query(`
                    INSERT INTO daily_availability
                      (plant_id, entry_date, paf_pct, paf_tnpdcl,
                       on_bar_hours, rsd_hours, forced_outage_hrs, planned_outage_hrs, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'submitted')
                    ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                      paf_pct=$3, paf_tnpdcl=$4,
                      on_bar_hours=$5, rsd_hours=$6, forced_outage_hrs=$7, planned_outage_hrs=$8,
                      status='submitted', updated_at=NOW()`,
                    [plantId, entryDate,
                     availData.paf_pct, availData.paf_tnpdcl,
                     availData.hours_on_grid, availData.rsd_hrs,
                     availData.forced_outage_hrs, availData.planned_outage_hrs]
                );

                // 6. daily_ash
                await client.query(`
                    INSERT INTO daily_ash
                      (plant_id, entry_date, fa_generated_mt, ba_generated_mt,
                       fa_to_user_mt, fa_to_dyke_mt, ba_to_user_mt, ba_to_dyke_mt, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'submitted')
                    ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                      fa_generated_mt=$3, ba_generated_mt=$4,
                      fa_to_user_mt=$5, fa_to_dyke_mt=$6, ba_to_user_mt=$7, ba_to_dyke_mt=$8,
                      status='submitted', updated_at=NOW()`,
                    [plantId, entryDate,
                     ashData.fa_generated_mt, ashData.ba_generated_mt,
                     ashData.fa_to_user_mt, ashData.fa_to_dyke_mt,
                     ashData.ba_to_user_mt, ashData.ba_to_dyke_mt]
                );

                // 7. daily_scheduling
                await client.query(`
                    INSERT INTO daily_scheduling
                      (plant_id, entry_date, dc_sepc_mu, dc_tnpdcl_mu, sg_ppa_mu, sg_rtm_mu, sg_dam_mu, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted')
                    ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                      dc_sepc_mu=$3, dc_tnpdcl_mu=$4, sg_ppa_mu=$5, sg_rtm_mu=$6, sg_dam_mu=$7,
                      status='submitted', updated_at=NOW()`,
                    [plantId, entryDate,
                     schedulingData.dc_sepc_mu, schedulingData.dc_tnpdcl_mu,
                     schedulingData.sg_ppa_mu,  schedulingData.sg_rtm_mu, schedulingData.sg_dam_mu]
                );

                // 8. operations_log (activities)
                if (activData.activities) {
                    await client.query(`
                        INSERT INTO operations_log (plant_id, entry_date, boiler_activities, bop_activities, status)
                        VALUES ($1,$2,$3,$4,'submitted')
                        ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                          boiler_activities=$3, bop_activities=$4,
                          status='submitted', updated_at=NOW()`,
                        [plantId, entryDate,
                         activData.activities, activData.running_equipment]
                    );
                }

                // 9. submission_status for all modules
                const modules = ['power', 'fuel', 'performance', 'availability', 'scheduling', 'water'];
                for (const m of modules) {
                    await client.query(`
                        INSERT INTO submission_status (plant_id, entry_date, module, status, submitted_by)
                        VALUES ($1,$2,$3,'submitted',$4)
                        ON CONFLICT (plant_id, entry_date, module) DO UPDATE SET
                          status='submitted', submitted_by=$4, submitted_at=NOW(), updated_at=NOW()`,
                        [plantId, entryDate, m, userId]
                    );
                }
            });

            logger.info('SEPC Excel import saved', { plantId, entryDate, sheetsFound });
            return success(res, { extracted, entryDate, sheetsFound, message: 'Excel imported — all modules saved & submitted' });

        } catch (err) {
            logger.error('SEPC Excel upload error', { message: err.message, stack: err.stack });
            return error(res, 'Failed to process Excel: ' + err.message, 500);
        }
    });
};
