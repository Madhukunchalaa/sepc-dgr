/**
 * inspect_taqa_db.js
 * Read current DB values for the 3 TAQA audit dates + their T-1 rows
 */
process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PLANT_ID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';
const DATES = ['2025-08-18', '2025-08-19', '2025-12-04', '2025-12-05', '2026-01-20', '2026-01-21'];

async function main() {
  const res = await pool.query(
    `SELECT entry_date,
            -- Generation
            gen_main_meter, gen_check_meter, gt_bay_imp_rdg,
            net_export, net_import_sy, schedule_gen_mldc,
            deemed_gen_mwhr, declared_capacity_mwhr,
            -- HFO
            hfo_supply_int_rdg, hfo_return_int_rdg,
            hfo_receipt_mt,
            -- Lignite
            lignite_conv_1a_int_rdg, lignite_conv_1b_int_rdg,
            lignite_receipt_taqa_wb, lignite_bunker_lvl,
            lignite_stock_plant, lignite_lifted_nlc,
            -- HSD
            hsd_stock_t30, hsd_stock_t40,
            -- Chemistry
            chem_ash_pct, chem_gcv_nlcil, chem_ubc_bottom_ash, chem_ubc_fly_ash,
            -- Water
            raw_water_to_dm, dm_water_prod_m3, dm_storage_tank_lvl,
            cw_blowdown, service_water_flow, seal_water_supply,
            potable_tank_makeup, borewell_to_reservoir, borewell_to_cw_forebay,
            -- Ash
            fa_silo_lvl_pct,
            -- Outage
            scheduled_outage_hrs, forced_outage_hrs, derated_hrs,
            unit_trip_count, unit_shutdown_count
     FROM taqa_daily_input
     WHERE plant_id = $1 AND entry_date = ANY($2)
     ORDER BY entry_date`,
    [PLANT_ID, DATES]
  );

  console.log('Rows found:', res.rows.length);
  res.rows.forEach(row => {
    console.log('\n─────────────────────────────────────────');
    console.log('DATE:', row.entry_date instanceof Date ? row.entry_date.toISOString().split('T')[0] : row.entry_date);
    console.log('GEN meters:', row.gen_main_meter, row.gen_check_meter, row.gt_bay_imp_rdg);
    console.log('Sched/Deemed/Decl:', row.schedule_gen_mldc, row.deemed_gen_mwhr, row.declared_capacity_mwhr);
    console.log('Net export/import:', row.net_export, row.net_import_sy);
    console.log('HFO supply/return int:', row.hfo_supply_int_rdg, row.hfo_return_int_rdg);
    console.log('HFO receipt:', row.hfo_receipt_mt);
    console.log('Lignite 1A/1B int:', row.lignite_conv_1a_int_rdg, row.lignite_conv_1b_int_rdg);
    console.log('Lignite rcpt/bunker/stock/lifted:', row.lignite_receipt_taqa_wb, row.lignite_bunker_lvl, row.lignite_stock_plant, row.lignite_lifted_nlc);
    console.log('HSD T30/T40:', row.hsd_stock_t30, row.hsd_stock_t40);
    console.log('Chem ash%/GCV/UBC_bot/UBC_fly:', row.chem_ash_pct, row.chem_gcv_nlcil, row.chem_ubc_bottom_ash, row.chem_ubc_fly_ash);
    console.log('Water raw_dm/dm_prod/storage:', row.raw_water_to_dm, row.dm_water_prod_m3, row.dm_storage_tank_lvl);
    console.log('Water cw_blow/svc_flow/seal/potable:', row.cw_blowdown, row.service_water_flow, row.seal_water_supply, row.potable_tank_makeup);
    console.log('Water borehole/cw_forebay:', row.borewell_to_reservoir, row.borewell_to_cw_forebay);
    console.log('Ash silo pct:', row.fa_silo_lvl_pct);
    console.log('Outage hrs sched/forced/derated/trips/shutdowns:', row.scheduled_outage_hrs, row.forced_outage_hrs, row.derated_hrs, row.unit_trip_count, row.unit_shutdown_count);
  });

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
