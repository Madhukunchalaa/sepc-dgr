-- Migration: Create taqa_daily_input table
-- Approach 1: Single table stores all 154 Ops Input + 5 Chem Input raw fields
-- TAQA controller reads this and calculates derived DGR metrics

CREATE TABLE IF NOT EXISTS taqa_daily_input (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id        UUID NOT NULL REFERENCES plants(id),
  entry_date      DATE NOT NULL,
  
  -- ── HFO TANKS ──────────────────────────────────────────────────────
  hfo_t10_lvl_calc        NUMERIC(8,2),   -- SN1: T-10 calculated level (cm)
  hfo_t10_lvl_panel       NUMERIC(8,2),   -- SN2: T-10 Panel level (cm)
  hfo_t10_lvl_radar       NUMERIC(8,2),   -- SN3: T-10 Radar level (cm)
  hfo_t10_temp            NUMERIC(5,2),   -- SN4: T-10 Tank Temp (Deg C)
  hfo_t20_lvl_calc        NUMERIC(8,2),   -- SN5: T-20 calculated level (cm)
  hfo_t20_lvl_panel       NUMERIC(8,2),   -- SN6: T-20 Panel level (cm)
  hfo_t20_lvl_radar       NUMERIC(8,2),   -- SN7: T-20 Radar level (cm)
  hfo_t20_temp            NUMERIC(5,2),   -- SN8: T-20 Tank Temp (Deg C)
  hfo_receipt_mt          NUMERIC(10,3),  -- SN9: HFO Receipt Qty (MT)
  hfo_supply_int_rdg      NUMERIC(14,2),  -- SN10: Main Boiler Supply FO Int Reading (Litres)
  hfo_return_int_rdg      NUMERIC(14,2),  -- SN11: Main Boiler Return FO Int Reading (Litres)
  
  -- ── HSD TANKS ─────────────────────────────────────────────────────
  hsd_t30_lvl             NUMERIC(8,2),   -- SN12: HSD T-30 Level (cm)
  hsd_t30_receipt_kl      NUMERIC(10,3),  -- SN13: HSD T-30 Receipt (KL)
  hsd_t40_lvl             NUMERIC(8,2),   -- SN14: HSD T-40 Level (cm)
  hsd_t40_receipt_kl      NUMERIC(10,3),  -- SN15: HSD T-40 Receipt (KL)
  
  -- ── LIGNITE ───────────────────────────────────────────────────────
  lignite_bc1_int_rdg     NUMERIC(14,2),  -- SN16: BC#1 Lignite Receipt integrator (MT)
  lignite_receipt_taqa_wb NUMERIC(10,3),  -- SN17: Lignite Receipt at TAQA WB (MT)
  lignite_lifted_nlcil_wb NUMERIC(10,3),  -- SN18: Lignite lifted from Mines NLCIL WB (MT)
  lignite_vadallur_silo   NUMERIC(10,3),  -- SN19: Vadallur Silo closing stock (MT)
  lignite_conv_1a_int_rdg NUMERIC(14,2),  -- SN20: Conveyor 1A Load Cell integrator (MT)
  lignite_conv_1b_int_rdg NUMERIC(14,2),  -- SN21: Conveyor 1B Load Cell integrator (MT)
  lignite_direct_feed     NUMERIC(10,3),  -- SN22: Lignite direct feeding (MT)
  lignite_bunker_lvl      NUMERIC(8,2),   -- SN23: Cumulative bunker level at 24:00 (%)
  fuel_master_250mw       NUMERIC(6,2),   -- SN24: Fuel master at 250MW (%)
  fuel_master_170mw       NUMERIC(6,2),   -- SN25: Fuel master at 170MW (%)
  
  -- ── METER READINGS (MWhr) ─────────────────────────────────────────
  peram_imp_main          NUMERIC(14,3),  -- SN26: Perambalur Import main
  peram_exp_main          NUMERIC(14,3),  -- SN27: Perambalur Export main
  peram_imp_check         NUMERIC(14,3),  -- SN28: Perambalur Import check
  peram_exp_check         NUMERIC(14,3),  -- SN29: Perambalur Export check
  deviak_imp_main         NUMERIC(14,3),  -- SN30: Deviakurichi Import main
  deviak_exp_main         NUMERIC(14,3),  -- SN31: Deviakurichi Export main
  deviak_imp_check        NUMERIC(14,3),  -- SN32: Deviakurichi Import check
  deviak_exp_check        NUMERIC(14,3),  -- SN33: Deviakurichi Export check
  cuddal_imp_main         NUMERIC(14,3),  -- SN34: Cuddalore Import main
  cuddal_exp_main         NUMERIC(14,3),  -- SN35: Cuddalore Export main
  cuddal_imp_check        NUMERIC(14,3),  -- SN36: Cuddalore Import check
  cuddal_exp_check        NUMERIC(14,3),  -- SN37: Cuddalore Export check
  nlc2_imp_main           NUMERIC(14,3),  -- SN38: NLC-II Import main
  nlc2_exp_main           NUMERIC(14,3),  -- SN39: NLC-II Export main
  nlc2_imp_check          NUMERIC(14,3),  -- SN40: NLC-II Import check
  nlc2_exp_check          NUMERIC(14,3),  -- SN41: NLC-II Export check
  net_import_sy           NUMERIC(14,3),  -- SN42: Net import Switchyard meters (MWhr)
  import_uat              NUMERIC(14,3),  -- SN43: Import UAT 1&2 meters (MWhr)
  net_export              NUMERIC(14,3),  -- SN44: Net Export (MWhr)
  schedule_gen_mldc       NUMERIC(14,3),  -- SN45: Schedule generation from MLDC (MWhr)
  gen_main_meter          NUMERIC(14,3),  -- SN46: Generator Main meter Display 3 (MWhr)
  gen_check_meter         NUMERIC(14,3),  -- SN47: Generator Check meter Display 3 (MWhr)
  uat1_main_rdg           NUMERIC(14,3),  -- SN48: UAT#1 main reading (MWhr)
  uat1_check_rdg          NUMERIC(14,3),  -- SN49: UAT#1 check reading (MWhr)
  uat2_main_rdg           NUMERIC(14,3),  -- SN50: UAT#2 main reading (MWhr)
  uat2_check_rdg          NUMERIC(14,3),  -- SN51: UAT#2 check reading (MWhr)
  gt_bay_imp_rdg          NUMERIC(14,3),  -- SN52: GT bay import Display 1+3 (MWh)
  gt_bay_exp_rdg          NUMERIC(14,3),  -- SN53: GT bay export Display 1+3 (MWh)
  
  -- ── GENERATION / SCHEDULING ────────────────────────────────────────
  declared_capacity_mwhr  NUMERIC(10,3),  -- SN54: Declared capacity (MWhr)
  deemed_gen_mwhr         NUMERIC(10,3),  -- SN55: Deemed Generation (MWhr)
  dispatch_demand_mwhr    NUMERIC(10,3),  -- SN56: Dispatch Demand (MWhr)
  
  -- ── OUTAGES / HOURS ───────────────────────────────────────────────
  no_unit_trips           NUMERIC(5,0),   -- SN57: No of Unit trip
  no_unit_shutdown        NUMERIC(5,0),   -- SN58: No of Unit Shutdown
  dispatch_duration       NUMERIC(6,2),   -- SN59: Dispatch duration (hrs)
  load_backdown_duration  NUMERIC(6,2),   -- SN60: Load Backdown duration (hrs)
  unit_standby_hrs        NUMERIC(6,2),   -- SN61: Unit on standby (hrs)
  scheduled_outage_hrs    NUMERIC(6,2),   -- SN62: Scheduled Outage duration (hrs)
  forced_outage_hrs       NUMERIC(6,2),   -- SN63: Forced Outage duration (hrs)
  derated_outage_hrs      NUMERIC(6,2),   -- SN64: De-rated Equivalent Outage (hrs)
  total_hours             NUMERIC(6,2),   -- SN65: Total Hours
  no_load_pickup_inst     NUMERIC(5,0),   -- SN66: No of Load pickup instructions
  no_load_backdown_inst   NUMERIC(5,0),   -- SN67: No of Load back-down instructions
  
  -- ── DSM ──────────────────────────────────────────────────────────
  dsm_charges             NUMERIC(14,2),  -- SN68: DSM Charges (Rs)
  net_gain_loss           NUMERIC(14,2),  -- SN69: Net Gain/Loss (Rs)
  fuel_saved_loss         NUMERIC(14,2),  -- SN70: Fuel Saved/Loss (Rs)
  remarks                 TEXT,           -- SN71: Remarks
  
  -- ── WATER TANK LEVELS ─────────────────────────────────────────────
  reservoir1_lvl          NUMERIC(8,3),   -- SN72: Reservoir #1 Level (M)
  reservoir2_lvl          NUMERIC(8,3),   -- SN73: Reservoir #2 Level (M)
  dm_storage_tank_lvl     NUMERIC(8,3),   -- SN74: DM water storage tank Level (M)
  potable_tank_lvl        NUMERIC(8,3),   -- SN75: Potable water tank Level (M)
  reserve_condensate_lvl  NUMERIC(8,3),   -- SN76: Reserve Condensate Tank Level (M)
  boiler_condensate_lvl   NUMERIC(8,3),   -- SN77: Boiler condensate Tank Level (CM)
  condensate_drain_lvl    NUMERIC(8,3),   -- SN78: Condensate Drain Tank Level (mm)
  
  -- ── WATER INTEGRATORS (M3) ────────────────────────────────────────
  dm_water_prod_m3        NUMERIC(10,2),  -- SN79: DM plant Water Production (M3)
  borewell_to_reservoir   NUMERIC(10,2),  -- SN80: Borewell header to Reservoir (M3)
  borewell_to_cw_forebay  NUMERIC(10,2),  -- SN81: Borewell to CW forebay makeup (M3)
  reservoir_to_cw_forebay NUMERIC(10,2),  -- SN82: Reservoir to CW forebay makeup (M3)
  cmb_to_cw_forebay       NUMERIC(10,2),  -- SN83: CMB discharge to CW forebay (M3)
  cw_blowdown             NUMERIC(10,2),  -- SN84: CW blowdown (M3)
  cw_blowdown_to_ahp      NUMERIC(10,2),  -- SN85: CW blowdown to AHP (M3)
  cw_blowdown_to_village  NUMERIC(10,2),  -- SN86: CW blowdown to village pond (M3)
  service_water_flow      NUMERIC(10,2),  -- SN87: Service water discharge flow (M3)
  seal_water_supply       NUMERIC(10,2),  -- SN88: Seal water supply (M3)
  seal_water_return       NUMERIC(10,2),  -- SN89: Seal water return (M3)
  raw_water_to_dm         NUMERIC(10,2),  -- SN90: Raw water to DM plant (M3)
  potable_tank_makeup     NUMERIC(10,2),  -- SN91: Potable tank makeup (M3)
  dm_to_condenser         NUMERIC(10,2),  -- SN92: DM water to condenser/CST (M3)
  cst_to_main_unit        NUMERIC(10,2),  -- SN93: CST to Main unit RCTP (M3)
  stp_inlet_flow          NUMERIC(10,2),  -- SN94: STP inlet flow (M3)
  stp_treated_flow        NUMERIC(10,2),  -- SN95: STP treated water flow (M3)
  firefighting_flow       NUMERIC(10,2),  -- SN96: Fire fighting water flow (M3)
  village_water1          NUMERIC(10,2),  -- SN97: Drinking water to village #1 (M3)
  village_water2          NUMERIC(10,2),  -- SN98: Drinking water to village #2 (M3)
  ash_pond_overflow       NUMERIC(10,2),  -- SN99: Ash pond overflow (M3)
  
  -- ── LHP / MILL HOURS ─────────────────────────────────────────────
  lhp_conv_1a_hrs         NUMERIC(6,2),   -- SN100: LHP Conveyor 1A (hrs)
  lhp_conv_1b_hrs         NUMERIC(6,2),   -- SN101: LHP Conveyor 1B (hrs)
  lhp_autosampler_hrs     NUMERIC(6,2),   -- SN102: LHP Autosampler (hrs)
  lhp_dss_pump1_hrs       NUMERIC(6,2),   -- SN103: LHP DSS pump-1 (hrs)
  lhp_dss_pump2_hrs       NUMERIC(6,2),   -- SN104: LHP DSS pump-2 (hrs)
  ff_hydrant_201_hrs      NUMERIC(6,2),   -- SN105: Firefighting Electric Hydrant-201 (hrs)
  ff_spray_301_hrs        NUMERIC(6,2),   -- SN106: Firefighting Electric Spray-301 (hrs)
  mill10_hrs              NUMERIC(6,2),   -- SN107: Mill 10 (hrs)
  mill20_hrs              NUMERIC(6,2),   -- SN108: Mill 20 (hrs)
  mill30_hrs              NUMERIC(6,2),   -- SN109: Mill 30 (hrs)
  mill40_hrs              NUMERIC(6,2),   -- SN110: Mill 40 (hrs)
  mill50_hrs              NUMERIC(6,2),   -- SN111: Mill 50 (hrs)
  mill60_hrs              NUMERIC(6,2),   -- SN112: Mill 60 (hrs)
  
  -- ── EQUIPMENT kWh READINGS ────────────────────────────────────────
  bfp1_kwh                NUMERIC(14,2),  -- SN113: Boiler Feed Pump-1 (Cu kWh)
  bfp2_kwh                NUMERIC(14,2),  -- SN114: Boiler Feed Pump-2 (Cu kWh)
  bfp3_kwh                NUMERIC(14,2),  -- SN115: Boiler Feed Pump-3 (Cu kWh)
  mcwp1_kwh               NUMERIC(14,2),  -- SN116: Main CW Pump-1 (Cu kWh)
  mcwp2_kwh               NUMERIC(14,2),  -- SN117: Main CW Pump-2 (Cu kWh)
  mcwp3_kwh               NUMERIC(14,2),  -- SN118: Main CW Pump-3 (Cu kWh)
  cep1_kwh                NUMERIC(14,2),  -- SN119: Condensate Extraction Pump-1 (Cu kWh)
  cep2_kwh                NUMERIC(14,2),  -- SN120: Condensate Extraction Pump-2 (Cu kWh)
  fdf1_kwh                NUMERIC(14,2),  -- SN121: Forced Draft Fan-1 (Cu kWh)
  fdf2_kwh                NUMERIC(14,2),  -- SN122: Forced Draft Fan-2 (Cu kWh)
  iac1_kwh                NUMERIC(14,2),  -- SN123: Instrument Air Compressor-1 (Cu kWh)
  iac2_kwh                NUMERIC(14,2),  -- SN124: Instrument Air Compressor-2 (Cu kWh)
  iac3_kwh                NUMERIC(14,2),  -- SN125: Instrument Air Compressor-3 (Cu kWh)
  cac1_kwh                NUMERIC(14,2),  -- SN126: Conveying Air Compressor-1 (Cu kWh)
  cac2_kwh                NUMERIC(14,2),  -- SN127: Conveying Air Compressor-2 (Cu kWh)
  cac3_kwh                NUMERIC(14,2),  -- SN128: Conveying Air Compressor-3 (Cu kWh)
  lhp_inc1_kwh            NUMERIC(14,2),  -- SN129: LHP Incomer-1 (Cu kWh)
  lhp_inc2_kwh            NUMERIC(14,2),  -- SN130: LHP Incomer-2 (Cu kWh)
  ff_spray_201_kwh        NUMERIC(14,2),  -- SN131: FF Electric Spray-201 (Cu kWh)
  ff_hydrant_301_kwh      NUMERIC(14,2),  -- SN132: FF Electric Hydrant-301 (Cu kWh)
  stp_kwh                 NUMERIC(14,2),  -- SN133: STP incomer (Cu kWh)
  
  -- ── ASH ──────────────────────────────────────────────────────────
  ba_trucks_internal      NUMERIC(5,0),   -- SN134: Bottom ash trucks internal
  ba_trucks_external      NUMERIC(5,0),   -- SN135: Bottom ash trucks external
  fa_silo_lvl_pct         NUMERIC(5,2),   -- SN136: Fly ash silo level (%)
  fa_trucks               NUMERIC(5,0),   -- SN137: Fly ash trucks
  fa_to_ash_pond_mt       NUMERIC(10,3),  -- SN138: Fly ash to ash pond (Mton)
  ahp_rot_feed1_hrs       NUMERIC(6,2),   -- SN139: AHP Rotary feeder #1 (hrs)
  ahp_rot_feed2_hrs       NUMERIC(6,2),   -- SN140: AHP Rotary feeder #2 (hrs)
  ash_tx_outage_hrs       NUMERIC(6,2),   -- SN141: Ash Transmitter outage (hrs)
  
  -- ── MISC ─────────────────────────────────────────────────────────
  h2_cylinders            NUMERIC(5,0),   -- SN142: Hydrogen cylinder consumption
  o2_cylinders            NUMERIC(5,0),   -- SN143: Oxygen cylinder consumption
  ctcs_balls_collected    NUMERIC(5,0),   -- SN144: CTCS Balls collected
  ctcs_balls_added        NUMERIC(5,0),   -- SN145: CTCS Balls added
  small_iac_hrs           NUMERIC(6,2),   -- SN146: Small IAC running hours
  day_highlights          TEXT,           -- SN147: Day highlights
  grid_freq_max           NUMERIC(6,3),   -- SN148: Grid Frequency Max (Hz)
  grid_freq_min           NUMERIC(6,3),   -- SN149: Grid Frequency Min (Hz)
  ambient_temp_max        NUMERIC(5,1),   -- SN150: Ambient Temp Max (Deg C)
  ambient_temp_min        NUMERIC(5,1),   -- SN151: Ambient Temp Min (Deg C)
  humidity_max            NUMERIC(5,1),   -- SN152: Relative Humidity Max (%)
  humidity_min            NUMERIC(5,1),   -- SN153: Relative Humidity Min (%)
  grid_disturbance        TEXT,           -- SN154: Grid disturbance

  -- ── CHEM INPUT (5 fields) ─────────────────────────────────────────
  chem_ash_sales_mt       NUMERIC(10,3),  -- CH1: Ash sales (Mton)
  chem_ash_pct            NUMERIC(6,3),   -- CH2: Ash Percentage (%)
  chem_gcv_nlcil          NUMERIC(8,2),   -- CH3: GCV results from NLCIL (kCal/kg)
  chem_ubc_bottom_ash     NUMERIC(6,3),   -- CH4: UBC in Bottom ash (%)
  chem_ubc_fly_ash        NUMERIC(6,3),   -- CH5: UBC in fly ash (%)
  
  -- ── METADATA ─────────────────────────────────────────────────────
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_by    UUID REFERENCES users(id),
  submitted_at    TIMESTAMP WITH TIME ZONE,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(plant_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_taqa_daily_input_plant_date 
  ON taqa_daily_input(plant_id, entry_date);

COMMENT ON TABLE taqa_daily_input IS 
  'Raw daily input from TAQA Ops Input (154 fields) + Chem Input (5 fields). 
   TAQA controller derives final DGR metrics from these raw values.';
