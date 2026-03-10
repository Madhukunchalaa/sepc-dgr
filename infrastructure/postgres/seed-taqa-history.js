// services/dgr-compute/src/scripts/seed-taqa-history.js
const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: process.env.DB_PORT || 5432
});

async function run() {
    const filePath = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['24 cal'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TAQA'");
    if (!plants.length) throw new Error('TAQA plant not found in DB');
    const plantId = plants[0].id;

    const parseNum = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    };

    const excelDateToISO = (v) => {
        if (typeof v === 'number') {
            const d = XLSX.SSF.parse_date_code(v);
            return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
        return null;
    };

    // Precise Row Indices (0-indexed from the '24 cal' sheet)
    const ROWS = {
        DATE: 0,
        HFO_CONS: 4,          // Row 5: Heavy Fuel Oil Consumption (MT)
        HSD_CONS: 8,          // Row 9: HSD consumption (KL) - Using T-30
        LIGNITE_CONS: 19,     // Row 20: Lignite consumption (corr with bunker lvl) (MT)
        EXPORT: 23,           // Row 24: Export (from Switchyard main meters) (MWhr)
        SCHEDULE: 27,         // Row 28: Schedule Generation from MLDC (SG) (MWhr)
        GROSS_GEN: 31,        // Row 32: Gross Generation - Main Meter. (MWhr)
        DC: 36,               // Row 37: Declared capacity for the day (MWhr)
        DEEMED: 37,           // Row 38: Deemed Generation for the day (MWhr)
        GCV_AF: 47,           // Row 48: GCV (As Fired) (kcal/kg)
        GHR: 48,              // Row 49: Gross Heat rate (kcal/kWh)
        APC_PCT: 49,          // Row 50: Aux.Power consumption % (%)
        GRID_HRS: 51,         // Row 52: Unit on Grid hours (hrs)
        DM_PROD: 57,          // Row 58: DM water Production for the day (m3)
        DM_CONS: 58,          // Row 59: DM water consumption for the day (m3)
        PLANT_WATER: 62,      // Row 63: Plant total water consumption (m3)
        ASH_GEN: 124,         // Row 125: Ash generation (MT)
        ASH_SALES: 125,       // Row 126: Ash Sales (MT)
        H2_CONS: 135,         // Row 136: Hydrogen cylinder consumption (Nos)
        O2_CONS: 136,         // Row 137: Oxygen cylinder consumption (Nos)
    };

    const datesRow = data[ROWS.DATE];
    let importedCount = 0;

    for (let c = 3; c < datesRow.length; c++) {
        const dateVal = datesRow[c];
        const dateStr = excelDateToISO(dateVal);
        if (!dateStr) continue;

        // Conversions
        const grossGenMu = parseNum(data[ROWS.GROSS_GEN][c]) / 1000;
        const exportMu = parseNum(data[ROWS.EXPORT][c]) / 1000;
        const dcMu = parseNum(data[ROWS.DC][c]) / 1000;
        const scheduleMu = parseNum(data[ROWS.SCHEDULE][c]) / 1000;
        const deemedMu = parseNum(data[ROWS.DEEMED][c]) / 1000;
        const apcPct = parseNum(data[ROWS.APC_PCT][c]) / 100;
        const gridHrs = parseNum(data[ROWS.GRID_HRS][c]);

        const hfoMt = parseNum(data[ROWS.HFO_CONS][c]);
        const hfoKl = hfoMt / 0.945; // Density
        const hsdKl = parseNum(data[ROWS.HSD_CONS][c]);
        const ligniteMt = parseNum(data[ROWS.LIGNITE_CONS][c]);
        const gcvAf = parseNum(data[ROWS.GCV_AF][c]);
        const ghrValue = parseNum(data[ROWS.GHR][c]);

        const plfDaily = grossGenMu / (250 * 24 / 1000);
        const pafPct = dcMu / (250 * 24 / 1000);

        const dmProd = parseNum(data[ROWS.DM_PROD][c]);
        const dmCons = parseNum(data[ROWS.DM_CONS][c]);
        const totalWater = parseNum(data[ROWS.PLANT_WATER][c]);

        const ashGen = parseNum(data[ROWS.ASH_GEN][c]);
        const ashSales = parseNum(data[ROWS.ASH_SALES][c]);
        const h2Cons = parseNum(data[ROWS.H2_CONS][c]);
        const o2Cons = parseNum(data[ROWS.O2_CONS][c]);

        // daily_power
        await pool.query(`
      INSERT INTO daily_power (plant_id, entry_date, generation_mu, export_mu, apc_pct, plf_daily, hours_on_grid, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        generation_mu = EXCLUDED.generation_mu,
        export_mu = EXCLUDED.export_mu,
        apc_pct = EXCLUDED.apc_pct,
        plf_daily = EXCLUDED.plf_daily,
        hours_on_grid = EXCLUDED.hours_on_grid,
        status = 'approved'
    `, [plantId, dateStr, grossGenMu, exportMu, apcPct, plfDaily, gridHrs]);

        // daily_fuel (Mapping Lignite to coal_cons_mt and LDO to hsdKl)
        await pool.query(`
      INSERT INTO daily_fuel (plant_id, entry_date, coal_cons_mt, hfo_cons_kl, ldo_cons_kl, coal_gcv_af, h2_cons, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        coal_cons_mt = EXCLUDED.coal_cons_mt,
        hfo_cons_kl = EXCLUDED.hfo_cons_kl,
        ldo_cons_kl = EXCLUDED.ldo_cons_kl,
        coal_gcv_af = EXCLUDED.coal_gcv_af,
        h2_cons = EXCLUDED.h2_cons,
        status = 'approved'
    `, [plantId, dateStr, ligniteMt, hfoKl, hsdKl, gcvAf, h2Cons]);

        // daily_performance
        await pool.query(`
      INSERT INTO daily_performance (plant_id, entry_date, gcv_af, status)
      VALUES ($1, $2, $3, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        gcv_af = EXCLUDED.gcv_af,
        status = 'approved'
    `, [plantId, dateStr, gcvAf]);

        // daily_availability
        await pool.query(`
      INSERT INTO daily_availability (plant_id, entry_date, paf_pct, status)
      VALUES ($1, $2, $3, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        paf_pct = EXCLUDED.paf_pct,
        status = 'approved'
    `, [plantId, dateStr, pafPct]);

        // daily_scheduling
        await pool.query(`
      INSERT INTO daily_scheduling (plant_id, entry_date, dc_sepc_mu, sg_ppa_mu, deemed_gen_mu, status)
      VALUES ($1, $2, $3, $4, $5, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        dc_sepc_mu = EXCLUDED.dc_sepc_mu,
        sg_ppa_mu = EXCLUDED.sg_ppa_mu,
        deemed_gen_mu = EXCLUDED.deemed_gen_mu,
        status = 'approved'
    `, [plantId, dateStr, dcMu, scheduleMu, deemedMu]);

        // daily_water
        await pool.query(`
      INSERT INTO daily_water (plant_id, entry_date, dm_generation_m3, dm_total_cons_m3, sea_water_m3, status)
      VALUES ($1, $2, $3, $4, $5, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        dm_generation_m3 = EXCLUDED.dm_generation_m3,
        dm_total_cons_m3 = EXCLUDED.dm_total_cons_m3,
        sea_water_m3 = EXCLUDED.sea_water_m3,
        status = 'approved'
    `, [plantId, dateStr, dmProd, dmCons, totalWater]);

        // daily_ash
        await pool.query(`
      INSERT INTO daily_ash (plant_id, entry_date, fa_generated_mt, fa_to_user_mt, status)
      VALUES ($1, $2, $3, $4, 'approved')
      ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        fa_generated_mt = EXCLUDED.fa_generated_mt,
        fa_to_user_mt = EXCLUDED.fa_to_user_mt,
        status = 'approved'
    `, [plantId, dateStr, ashGen, ashSales]);

        importedCount++;
    }

    console.log(`Successfully (re)imported ${importedCount} days of historical data for TAQA with precise row mapping.`);
    await pool.end();
}

run().catch(console.error);
