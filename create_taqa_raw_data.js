const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        console.log('Creating new taqa_raw_data table with high precision...');

        await pool.query(`
 CREATE TABLE IF NOT EXISTS taqa_raw_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id        UUID NOT NULL REFERENCES plants(id),
  entry_date      DATE NOT NULL,
  
  -- HFO TANKS
  hfo_t10_lvl_calc        NUMERIC(24,6),
  hfo_t10_lvl_panel       NUMERIC(24,6),
  hfo_t10_lvl_radar       NUMERIC(24,6),
  hfo_t10_temp            NUMERIC(24,6),
  hfo_t20_lvl_calc        NUMERIC(24,6),
  hfo_t20_lvl_panel       NUMERIC(24,6),
  hfo_t20_lvl_radar       NUMERIC(24,6),
  hfo_t20_temp            NUMERIC(24,6),
  hfo_receipt_mt          NUMERIC(24,6),
  hfo_supply_int_rdg      NUMERIC(24,6),
  hfo_return_int_rdg      NUMERIC(24,6),
  
  -- HSD TANKS
  hsd_t30_lvl             NUMERIC(24,6),
  hsd_t30_receipt_kl      NUMERIC(24,6),
  hsd_t40_lvl             NUMERIC(24,6),
  hsd_t40_receipt_kl      NUMERIC(24,6),
  
  -- LIGNITE
  lignite_bc1_int_rdg     NUMERIC(24,6),
  lignite_receipt_taqa_wb NUMERIC(24,6),
  lignite_lifted_nlcil_wb NUMERIC(24,6),
  lignite_vadallur_silo   NUMERIC(24,6),
  lignite_conv_1a_int_rdg NUMERIC(24,6),
  lignite_conv_1b_int_rdg NUMERIC(24,6),
  lignite_direct_feed     NUMERIC(24,6),
  lignite_bunker_lvl      NUMERIC(24,6),
  fuel_master_250mw       NUMERIC(24,6),
  fuel_master_170mw       NUMERIC(24,6),
  
  -- METER READINGS
  peram_imp_main          NUMERIC(24,6),
  peram_exp_main          NUMERIC(24,6),
  peram_imp_check         NUMERIC(24,6),
  peram_exp_check         NUMERIC(24,6),
  deviak_imp_main         NUMERIC(24,6),
  deviak_exp_main         NUMERIC(24,6),
  deviak_imp_check        NUMERIC(24,6),
  deviak_exp_check        NUMERIC(24,6),
  cuddal_imp_main         NUMERIC(24,6),
  cuddal_exp_main         NUMERIC(24,6),
  cuddal_imp_check        NUMERIC(24,6),
  cuddal_exp_check        NUMERIC(24,6),
  nlc2_imp_main           NUMERIC(24,6),
  nlc2_exp_main           NUMERIC(24,6),
  nlc2_imp_check          NUMERIC(24,6),
  nlc2_exp_check          NUMERIC(24,6),
  net_import_sy           NUMERIC(24,6),
  import_uat              NUMERIC(24,6),
  net_export              NUMERIC(24,6),
  schedule_gen_mldc       NUMERIC(24,6),
  gen_main_meter          NUMERIC(24,6),
  gen_check_meter         NUMERIC(24,6),
  uat1_main_rdg           NUMERIC(24,6),
  uat1_check_rdg          NUMERIC(24,6),
  uat2_main_rdg           NUMERIC(24,6),
  uat2_check_rdg          NUMERIC(24,6),
  gt_bay_imp_rdg          NUMERIC(24,6),
  gt_bay_exp_rdg          NUMERIC(24,6),
  
  -- GENERATION / SCHEDULING
  declared_capacity_mwhr  NUMERIC(24,6),
  deemed_gen_mwhr         NUMERIC(24,6),
  dispatch_demand_mwhr    NUMERIC(24,6),
  
  -- OUTAGES / HOURS
  no_unit_trips           NUMERIC(24,6),
  no_unit_shutdown        NUMERIC(24,6),
  dispatch_duration       NUMERIC(24,6),
  load_backdown_duration  NUMERIC(24,6),
  unit_standby_hrs        NUMERIC(24,6),
  scheduled_outage_hrs    NUMERIC(24,6),
  forced_outage_hrs       NUMERIC(24,6),
  derated_outage_hrs      NUMERIC(24,6),
  total_hours             NUMERIC(24,6),
  no_load_pickup_inst     NUMERIC(24,6),
  no_load_backdown_inst   NUMERIC(24,6),
  
  -- DSM
  dsm_charges             NUMERIC(24,6),
  net_gain_loss           NUMERIC(24,6),
  fuel_saved_loss         NUMERIC(24,6),
  remarks                 TEXT,
  
  -- WATER TANK LEVELS
  reservoir1_lvl          NUMERIC(24,6),
  reservoir2_lvl          NUMERIC(24,6),
  dm_storage_tank_lvl     NUMERIC(24,6),
  potable_tank_lvl        NUMERIC(24,6),
  reserve_condensate_lvl  NUMERIC(24,6),
  boiler_condensate_lvl   NUMERIC(24,6),
  condensate_drain_lvl    NUMERIC(24,6),
  
  -- WATER INTEGRATORS
  dm_water_prod_m3        NUMERIC(24,6),
  borewell_to_reservoir   NUMERIC(24,6),
  borewell_to_cw_forebay  NUMERIC(24,6),
  reservoir_to_cw_forebay NUMERIC(24,6),
  cmb_to_cw_forebay       NUMERIC(24,6),
  cw_blowdown             NUMERIC(24,6),
  cw_blowdown_to_ahp      NUMERIC(24,6),
  cw_blowdown_to_village  NUMERIC(24,6),
  service_water_flow      NUMERIC(24,6),
  seal_water_supply       NUMERIC(24,6),
  seal_water_return       NUMERIC(24,6),
  raw_water_to_dm         NUMERIC(24,6),
  potable_tank_makeup     NUMERIC(24,6),
  dm_to_condenser         NUMERIC(24,6),
  cst_to_main_unit        NUMERIC(24,6),
  stp_inlet_flow          NUMERIC(24,6),
  stp_treated_flow        NUMERIC(24,6),
  firefighting_flow       NUMERIC(24,6),
  village_water1          NUMERIC(24,6),
  village_water2          NUMERIC(24,6),
  ash_pond_overflow       NUMERIC(24,6),
  
  -- LHP / MILL HOURS
  lhp_conv_1a_hrs         NUMERIC(24,6),
  lhp_conv_1b_hrs         NUMERIC(24,6),
  lhp_autosampler_hrs     NUMERIC(24,6),
  lhp_dss_pump1_hrs       NUMERIC(24,6),
  lhp_dss_pump2_hrs       NUMERIC(24,6),
  ff_hydrant_201_hrs      NUMERIC(24,6),
  ff_spray_301_hrs        NUMERIC(24,6),
  mill10_hrs              NUMERIC(24,6),
  mill20_hrs              NUMERIC(24,6),
  mill30_hrs              NUMERIC(24,6),
  mill40_hrs              NUMERIC(24,6),
  mill50_hrs              NUMERIC(24,6),
  mill60_hrs              NUMERIC(24,6),
  
  -- EQUIPMENT kWh
  bfp1_kwh                NUMERIC(24,6),
  bfp2_kwh                NUMERIC(24,6),
  bfp3_kwh                NUMERIC(24,6),
  mcwp1_kwh               NUMERIC(24,6),
  mcwp2_kwh               NUMERIC(24,6),
  mcwp3_kwh               NUMERIC(24,6),
  cep1_kwh                NUMERIC(24,6),
  cep2_kwh                NUMERIC(24,6),
  fdf1_kwh                NUMERIC(24,6),
  fdf2_kwh                NUMERIC(24,6),
  iac1_kwh                NUMERIC(24,6),
  iac2_kwh                NUMERIC(24,6),
  iac3_kwh                NUMERIC(24,6),
  cac1_kwh                NUMERIC(24,6),
  cac2_kwh                NUMERIC(24,6),
  cac3_kwh                NUMERIC(24,6),
  lhp_inc1_kwh            NUMERIC(24,6),
  lhp_inc2_kwh            NUMERIC(24,6),
  ff_spray_201_kwh        NUMERIC(24,6),
  ff_hydrant_301_kwh      NUMERIC(24,6),
  stp_kwh                 NUMERIC(24,6),
  
  -- ASH
  ba_trucks_internal      NUMERIC(24,6),
  ba_trucks_external      NUMERIC(24,6),
  fa_silo_lvl_pct         NUMERIC(24,6),
  fa_trucks               NUMERIC(24,6),
  fa_to_ash_pond_mt       NUMERIC(24,6),
  ahp_rot_feed1_hrs       NUMERIC(24,6),
  ahp_rot_feed2_hrs       NUMERIC(24,6),
  ash_tx_outage_hrs       NUMERIC(24,6),
  
  -- MISC
  h2_cylinders            NUMERIC(24,6),
  o2_cylinders            NUMERIC(24,6),
  ctcs_balls_collected    NUMERIC(24,6),
  ctcs_balls_added        NUMERIC(24,6),
  small_iac_hrs           NUMERIC(24,6),
  day_highlights          TEXT,
  grid_freq_max           NUMERIC(24,6),
  grid_freq_min           NUMERIC(24,6),
  ambient_temp_max        NUMERIC(24,6),
  ambient_temp_min        NUMERIC(24,6),
  humidity_max            NUMERIC(24,6),
  humidity_min            NUMERIC(24,6),
  grid_disturbance        TEXT,
  
  -- CHEM INPUT
  chem_ash_sales_mt       NUMERIC(24,6),
  chem_ash_pct            NUMERIC(24,6),
  chem_gcv_nlcil          NUMERIC(24,6),
  chem_ubc_bottom_ash     NUMERIC(24,6),
  chem_ubc_fly_ash        NUMERIC(24,6),

  status          VARCHAR(20) DEFAULT 'draft',
  submitted_by    UUID,
  submitted_at    TIMESTAMPTZ,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_taqa_raw_plant_date ON taqa_raw_data(plant_id, entry_date DESC);
        `);

        console.log('✅ Table taqa_raw_data created successfully.');
    } catch (e) {
        console.error('❌ Creation failed:', e.message || e);
    } finally {
        await pool.end();
    }
}
run();
