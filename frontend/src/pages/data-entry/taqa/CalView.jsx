// src/pages/data-entry/taqa/CalView.jsx
// Displays the "24 cal" sheet data — raw taqa_daily_input fields for any selected date
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlant } from '../../../context/PlantContext'
import { dataEntry } from '../../../api'

const today = new Date().toISOString().split('T')[0]
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()

// ── Complete 148-row field mapping matching Excel "24 cal" sheet layout ──────
const CAL_SECTIONS = [
    {
        title: '🛢️ HFO Tanks',
        rows: [
            { sn: 1,  label: 'Heavy Fuel Oil Stock  T-10 Lvl',           field: 'hfo_t10_lvl_calc',      unit: 'cm' },
            { sn: 2,  label: 'Heavy Fuel Oil Stock  T-20 Lvl',           field: 'hfo_t20_lvl_calc',      unit: 'cm' },
            { sn: 3,  label: 'T-10 Level (Panel)',                        field: 'hfo_t10_lvl_panel',     unit: 'cm' },
            { sn: 4,  label: 'T-10 Level (Radar)',                        field: 'hfo_t10_lvl_radar',     unit: 'cm' },
            { sn: 5,  label: 'T-10 Tank Temp',                            field: 'hfo_t10_temp',          unit: '°C' },
            { sn: 6,  label: 'T-20 Level (Panel)',                        field: 'hfo_t20_lvl_panel',     unit: 'cm' },
            { sn: 7,  label: 'T-20 Level (Radar)',                        field: 'hfo_t20_lvl_radar',     unit: 'cm' },
            { sn: 8,  label: 'T-20 Tank Temp',                            field: 'hfo_t20_temp',          unit: '°C' },
            { sn: 9,  label: 'Heavy Fuel Oil  Receipt',                   field: 'hfo_receipt_mt',        unit: 'MT' },
            { sn: 10, label: 'Heavy Fuel Oil Consumption (Main Boiler Supply Int. Rdg)', field: 'hfo_supply_int_rdg', unit: 'Litres' },
            { sn: 11, label: 'Main Boiler Return FO Int. Rdg',            field: 'hfo_return_int_rdg',    unit: 'Litres' },
        ]
    },
    {
        title: '⛽ High Speed Diesel',
        rows: [
            { sn: 12, label: 'High Speed Diesel  T-30 Lvl',              field: 'hsd_t30_lvl',           unit: 'cm' },
            { sn: 13, label: 'High Speed Diesel  Receipt (T-30)',         field: 'hsd_t30_receipt_kl',    unit: 'KL' },
            { sn: 14, label: 'HSD Consumption (T-30)',                    field: 'hsd_t30_lvl',           unit: 'cm', derived: true },
            { sn: 15, label: 'HSD Inventory (T-30)',                      field: 'hsd_t30_lvl',           unit: 'cm', derived: true },
            { sn: 16, label: 'High Speed Diesel  T-40 Lvl',              field: 'hsd_t40_lvl',           unit: 'cm' },
            { sn: 17, label: 'High Speed Diesel oil Receipt (T-40)',      field: 'hsd_t40_receipt_kl',    unit: 'KL' },
        ]
    },
    {
        title: '🪨 Lignite',
        rows: [
            { sn: 18, label: 'Lignite lifted from Mines - NLCIL - WB (06:00)',         field: 'lignite_lifted_nlcil_wb',   unit: 'MT' },
            { sn: 19, label: 'Lignite Receipt - TAQA - WB (06:00 hrs to 06:00)',       field: 'lignite_receipt_taqa_wb',   unit: 'MT' },
            { sn: 20, label: 'Lignite consumption 1A1B (Conv. 1A + 1B LC Integrator)', field: 'lignite_conv_1a_int_rdg',   unit: 'MT' },
            { sn: 21, label: 'Conveyor 1B Load Cell Integrator',                       field: 'lignite_conv_1b_int_rdg',   unit: 'MT' },
            { sn: 22, label: 'Lignite Bunker Level at 24:00',                          field: 'lignite_bunker_lvl',        unit: '%' },
            { sn: 23, label: 'Lignite consumption (corr with bunker lvl)',              field: 'lignite_receipt_taqa_wb',   unit: 'MT', derived: true },
            { sn: 24, label: 'Vadallur Silo Closing Stock',                            field: 'lignite_vadallur_silo',     unit: 'MT' },
            { sn: 25, label: 'BC #1 Lignite Receipt Integrator',                       field: 'lignite_bc1_int_rdg',       unit: 'MT' },
            { sn: 26, label: 'Lignite Direct Feed to Boiler Bunkers',                  field: 'lignite_direct_feed',       unit: 'MT' },
            { sn: 27, label: 'Fuel Master at 250MW (24hr Avg)',                        field: 'fuel_master_250mw',         unit: '%' },
            { sn: 28, label: 'Fuel Master at 170MW (24hr Avg)',                        field: 'fuel_master_170mw',         unit: '%' },
        ]
    },
    {
        title: '⚡ Meter Readings — Integrators (MWhr)',
        rows: [
            { sn: 29, label: 'Perambalur Import (main)',                  field: 'peram_imp_main',        unit: 'MWhr' },
            { sn: 30, label: 'Perambalur Export (main)',                  field: 'peram_exp_main',        unit: 'MWhr' },
            { sn: 31, label: 'Perambalur Import (check)',                 field: 'peram_imp_check',       unit: 'MWhr' },
            { sn: 32, label: 'Perambalur Export (check)',                 field: 'peram_exp_check',       unit: 'MWhr' },
            { sn: 33, label: 'Deviakurichi Import (main)',                field: 'deviak_imp_main',       unit: 'MWhr' },
            { sn: 34, label: 'Deviakurichi Export (main)',                field: 'deviak_exp_main',       unit: 'MWhr' },
            { sn: 35, label: 'Deviakurichi Import (check)',               field: 'deviak_imp_check',      unit: 'MWhr' },
            { sn: 36, label: 'Deviakurichi Export (check)',               field: 'deviak_exp_check',      unit: 'MWhr' },
            { sn: 37, label: 'Cuddalore Import (main)',                   field: 'cuddal_imp_main',       unit: 'MWhr' },
            { sn: 38, label: 'Cuddalore Export (main)',                   field: 'cuddal_exp_main',       unit: 'MWhr' },
            { sn: 39, label: 'Cuddalore Import (check)',                  field: 'cuddal_imp_check',      unit: 'MWhr' },
            { sn: 40, label: 'Cuddalore Export (check)',                  field: 'cuddal_exp_check',      unit: 'MWhr' },
            { sn: 41, label: 'NLC-II Import (main)',                      field: 'nlc2_imp_main',         unit: 'MWhr' },
            { sn: 42, label: 'NLC-II Export (main)',                      field: 'nlc2_exp_main',         unit: 'MWhr' },
            { sn: 43, label: 'NLC-II Import (check)',                     field: 'nlc2_imp_check',        unit: 'MWhr' },
            { sn: 44, label: 'NLC-II Export (check)',                     field: 'nlc2_exp_check',        unit: 'MWhr' },
            { sn: 45, label: 'Net Import (Switchyard meters)',             field: 'net_import_sy',         unit: 'MWhr' },
            { sn: 46, label: 'Import UAT 1 & 2 meters',                  field: 'import_uat',            unit: 'MWhr' },
            { sn: 47, label: 'Net Export',                                field: 'net_export',            unit: 'MWhr' },
            { sn: 48, label: 'Schedule Generation from MLDC (SG)',        field: 'schedule_gen_mldc',     unit: 'MWhr' },
            { sn: 49, label: 'Generator Main Meter (Display 3)',           field: 'gen_main_meter',        unit: 'MWhr' },
            { sn: 50, label: 'Generator Check Meter (Display 3)',          field: 'gen_check_meter',       unit: 'MWhr' },
            { sn: 51, label: 'UAT #1 Main Reading',                       field: 'uat1_main_rdg',         unit: 'MWhr' },
            { sn: 52, label: 'UAT #1 Check Reading',                      field: 'uat1_check_rdg',        unit: 'MWhr' },
            { sn: 53, label: 'UAT #2 Main Reading',                       field: 'uat2_main_rdg',         unit: 'MWhr' },
            { sn: 54, label: 'UAT #2 Check Reading',                      field: 'uat2_check_rdg',        unit: 'MWhr' },
            { sn: 55, label: 'GT Bay Import (Display 1+3)',                field: 'gt_bay_imp_rdg',        unit: 'MWhr' },
            { sn: 56, label: 'GT Bay Export (Display 1+3)',                field: 'gt_bay_exp_rdg',        unit: 'MWhr' },
        ]
    },
    {
        title: '🏭 Generation & Scheduling',
        rows: [
            { sn: 57, label: 'Declared Capacity',                         field: 'declared_capacity_mwhr',unit: 'MWhr' },
            { sn: 58, label: 'Deemed Generation',                          field: 'deemed_gen_mwhr',       unit: 'MWhr' },
            { sn: 59, label: 'Dispatch Demand',                            field: 'dispatch_demand_mwhr',  unit: 'MWhr' },
        ]
    },
    {
        title: '⏱️ Durations & Outages',
        rows: [
            { sn: 60, label: 'No. of Unit Trips',                         field: 'no_unit_trips',         unit: "No's" },
            { sn: 61, label: 'No. of Unit Shutdown',                      field: 'no_unit_shutdown',      unit: "No's" },
            { sn: 62, label: 'Dispatch Duration',                          field: 'dispatch_duration',     unit: 'hrs' },
            { sn: 63, label: 'Load Backdown Duration (170 MW)',            field: 'load_backdown_duration',unit: 'hrs' },
            { sn: 64, label: 'Unit on Standby (RSD)',                      field: 'unit_standby_hrs',      unit: 'hrs' },
            { sn: 65, label: 'Scheduled Outage Duration',                  field: 'scheduled_outage_hrs',  unit: 'hrs' },
            { sn: 66, label: 'Forced Outage Duration',                     field: 'forced_outage_hrs',     unit: 'hrs' },
            { sn: 67, label: 'De-rated Equivalent Outage Duration',        field: 'derated_outage_hrs',    unit: 'hrs' },
            { sn: 68, label: 'Total Hours',                                field: 'total_hours',           unit: 'hrs' },
            { sn: 69, label: 'No. of Load Pickup Instructions',            field: 'no_load_pickup_inst',   unit: "No's" },
            { sn: 70, label: 'No. of Load Back-down Instructions',         field: 'no_load_backdown_inst', unit: "No's" },
        ]
    },
    {
        title: '💰 DSM Charges',
        rows: [
            { sn: 71, label: 'DSM Charges (payable/receivables)',          field: 'dsm_charges',           unit: 'Rs' },
            { sn: 72, label: 'Net Gain / Loss',                            field: 'net_gain_loss',         unit: 'Rs' },
            { sn: 73, label: 'Fuel Saved / Loss',                          field: 'fuel_saved_loss',       unit: 'Rs' },
        ]
    },
    {
        title: '💧 Water Tank Levels',
        rows: [
            { sn: 74, label: 'Reservoir #1 Level',                        field: 'reservoir1_lvl',        unit: 'M' },
            { sn: 75, label: 'Reservoir #2 Level',                        field: 'reservoir2_lvl',        unit: 'M' },
            { sn: 76, label: 'DM Water Storage Tank Level',               field: 'dm_storage_tank_lvl',   unit: 'M' },
            { sn: 77, label: 'Potable Water Tank Level',                  field: 'potable_tank_lvl',      unit: 'M' },
            { sn: 78, label: 'Reserve Condensate Tank Level',             field: 'reserve_condensate_lvl',unit: 'M' },
            { sn: 79, label: 'Boiler Condensate Tank Level',              field: 'boiler_condensate_lvl', unit: 'CM' },
            { sn: 80, label: 'Condensate Drain Tank Level',               field: 'condensate_drain_lvl',  unit: 'mm' },
        ]
    },
    {
        title: '💧 Water Integrator Readings (M³)',
        rows: [
            { sn: 81,  label: 'DM Plant Water Production',                field: 'dm_water_prod_m3',      unit: 'M³' },
            { sn: 82,  label: 'Borewell Header to Reservoir',             field: 'borewell_to_reservoir', unit: 'M³' },
            { sn: 83,  label: 'Borewell to CW Forebay Makeup',           field: 'borewell_to_cw_forebay',unit: 'M³' },
            { sn: 84,  label: 'Reservoir to CW Forebay Makeup',          field: 'reservoir_to_cw_forebay',unit:'M³' },
            { sn: 85,  label: 'CMB Discharge to CW Forebay',             field: 'cmb_to_cw_forebay',     unit: 'M³' },
            { sn: 86,  label: 'CW Blowdown',                              field: 'cw_blowdown',           unit: 'M³' },
            { sn: 87,  label: 'CW Blowdown to AHP',                      field: 'cw_blowdown_to_ahp',    unit: 'M³' },
            { sn: 88,  label: 'CW Blowdown to Village Pond',             field: 'cw_blowdown_to_village',unit: 'M³' },
            { sn: 89,  label: 'Service Water Discharge Flow',             field: 'service_water_flow',    unit: 'M³' },
            { sn: 90,  label: 'Seal Water Supply',                        field: 'seal_water_supply',     unit: 'M³' },
            { sn: 91,  label: 'Seal Water Return to Service Sump',       field: 'seal_water_return',     unit: 'M³' },
            { sn: 92,  label: 'Raw Water from Reservoir to DM Plant',    field: 'raw_water_to_dm',       unit: 'M³' },
            { sn: 93,  label: 'Potable Tank Makeup',                      field: 'potable_tank_makeup',   unit: 'M³' },
            { sn: 94,  label: 'DM Water to Condenser / CST',             field: 'dm_to_condenser',       unit: 'M³' },
            { sn: 95,  label: 'CST to Main Unit (RCTP discharge)',        field: 'cst_to_main_unit',      unit: 'M³' },
            { sn: 96,  label: 'STP Inlet Flow',                           field: 'stp_inlet_flow',        unit: 'M³' },
            { sn: 97,  label: 'STP Treated Water Flow',                   field: 'stp_treated_flow',      unit: 'M³' },
            { sn: 98,  label: 'Fire Fighting Water Flow',                 field: 'firefighting_flow',     unit: 'M³' },
            { sn: 99,  label: 'Drinking Water to Village #1',             field: 'village_water1',        unit: 'M³' },
            { sn: 100, label: 'Drinking Water to Village #2',             field: 'village_water2',        unit: 'M³' },
            { sn: 101, label: 'Ash Pond Overflow',                        field: 'ash_pond_overflow',     unit: 'M³' },
        ]
    },
    {
        title: '🔧 LHP / Mill Operating Hours',
        rows: [
            { sn: 102, label: 'LHP Conveyor 1A',                          field: 'lhp_conv_1a_hrs',       unit: 'hrs' },
            { sn: 103, label: 'LHP Conveyor 1B',                          field: 'lhp_conv_1b_hrs',       unit: 'hrs' },
            { sn: 104, label: 'LHP Auto Sampler',                         field: 'lhp_autosampler_hrs',   unit: 'hrs' },
            { sn: 105, label: 'LHP DSS Pump-1',                           field: 'lhp_dss_pump1_hrs',     unit: 'hrs' },
            { sn: 106, label: 'LHP DSS Pump-2',                           field: 'lhp_dss_pump2_hrs',     unit: 'hrs' },
            { sn: 107, label: 'Firefighting Electric Hydrant-201',         field: 'ff_hydrant_201_hrs',    unit: 'hrs' },
            { sn: 108, label: 'Firefighting Electric Spray-301',           field: 'ff_spray_301_hrs',      unit: 'hrs' },
            { sn: 109, label: 'Mill 10 (Lignite Conveyor 14)',             field: 'mill10_hrs',            unit: 'hrs' },
            { sn: 110, label: 'Mill 20 (Lignite Conveyor 24)',             field: 'mill20_hrs',            unit: 'hrs' },
            { sn: 111, label: 'Mill 30 (Lignite Conveyor 35)',             field: 'mill30_hrs',            unit: 'hrs' },
            { sn: 112, label: 'Mill 40 (Lignite Conveyor 45)',             field: 'mill40_hrs',            unit: 'hrs' },
            { sn: 113, label: 'Mill 50 (Lignite Conveyor 54)',             field: 'mill50_hrs',            unit: 'hrs' },
            { sn: 114, label: 'Mill 60 (Lignite Conveyor 64)',             field: 'mill60_hrs',            unit: 'hrs' },
        ]
    },
    {
        title: '📟 Equipment Cumulative kWh Readings',
        rows: [
            { sn: 115, label: 'Boiler Feed Pump-1',                       field: 'bfp1_kwh',              unit: 'Cu kWh' },
            { sn: 116, label: 'Boiler Feed Pump-2',                       field: 'bfp2_kwh',              unit: 'Cu kWh' },
            { sn: 117, label: 'Boiler Feed Pump-3',                       field: 'bfp3_kwh',              unit: 'Cu kWh' },
            { sn: 118, label: 'Main CW Pump-1',                           field: 'mcwp1_kwh',             unit: 'Cu kWh' },
            { sn: 119, label: 'Main CW Pump-2',                           field: 'mcwp2_kwh',             unit: 'Cu kWh' },
            { sn: 120, label: 'Main CW Pump-3',                           field: 'mcwp3_kwh',             unit: 'Cu kWh' },
            { sn: 121, label: 'Condensate Extraction Pump-1',             field: 'cep1_kwh',              unit: 'Cu kWh' },
            { sn: 122, label: 'Condensate Extraction Pump-2',             field: 'cep2_kwh',              unit: 'Cu kWh' },
            { sn: 123, label: 'Forced Draft Fan-1',                       field: 'fdf1_kwh',              unit: 'Cu kWh' },
            { sn: 124, label: 'Forced Draft Fan-2',                       field: 'fdf2_kwh',              unit: 'Cu kWh' },
            { sn: 125, label: 'Instrument Air Compressor-1',              field: 'iac1_kwh',              unit: 'Cu kWh' },
            { sn: 126, label: 'Instrument Air Compressor-2',              field: 'iac2_kwh',              unit: 'Cu kWh' },
            { sn: 127, label: 'Instrument Air Compressor-3',              field: 'iac3_kwh',              unit: 'Cu kWh' },
            { sn: 128, label: 'Conveying Air Compressor-1',               field: 'cac1_kwh',              unit: 'Cu kWh' },
            { sn: 129, label: 'Conveying Air Compressor-2',               field: 'cac2_kwh',              unit: 'Cu kWh' },
            { sn: 130, label: 'Conveying Air Compressor-3',               field: 'cac3_kwh',              unit: 'Cu kWh' },
            { sn: 131, label: 'LHP Incomer-1',                            field: 'lhp_inc1_kwh',          unit: 'Cu kWh' },
            { sn: 132, label: 'LHP Incomer-2',                            field: 'lhp_inc2_kwh',          unit: 'Cu kWh' },
            { sn: 133, label: 'FF Electric Spray-201',                    field: 'ff_spray_201_kwh',      unit: 'Cu kWh' },
            { sn: 134, label: 'FF Electric Hydrant-301',                  field: 'ff_hydrant_301_kwh',    unit: 'Cu kWh' },
            { sn: 135, label: 'STP Incomer',                              field: 'stp_kwh',               unit: 'Cu kWh' },
        ]
    },
    {
        title: '💨 Ash Handling',
        rows: [
            { sn: 136, label: 'Bottom Ash Trucks (Internal)',              field: 'ba_trucks_internal',    unit: "No's" },
            { sn: 137, label: 'Bottom Ash Trucks (External Party)',        field: 'ba_trucks_external',    unit: "No's" },
            { sn: 138, label: 'Fly Ash Silo Level',                       field: 'fa_silo_lvl_pct',       unit: '%' },
            { sn: 139, label: 'Fly Ash Trucks',                           field: 'fa_trucks',             unit: "No's" },
            { sn: 140, label: 'Fly Ash to Ash Pond (Wet disposal)',       field: 'fa_to_ash_pond_mt',     unit: 'Mton' },
            { sn: 141, label: 'AHP Rotary Feeder #1',                     field: 'ahp_rot_feed1_hrs',     unit: 'hrs' },
            { sn: 142, label: 'AHP Rotary Feeder #2',                     field: 'ahp_rot_feed2_hrs',     unit: 'hrs' },
            { sn: 143, label: 'Ash Transmitter Outage (all Tx incl RAPH)',field: 'ash_tx_outage_hrs',     unit: 'hrs' },
        ]
    },
    {
        title: '🧪 Chemistry (Chem Input)',
        rows: [
            { sn: 144, label: 'Ash % (NLCIL Sample)',                     field: 'chem_ash_pct',          unit: '%' },
            { sn: 145, label: 'GCV NLCIL (kcal/kg)',                      field: 'chem_gcv_nlcil',        unit: 'kcal/kg' },
            { sn: 146, label: 'UBC Bottom Ash',                           field: 'chem_ubc_bottom_ash',   unit: '%' },
            { sn: 147, label: 'UBC Fly Ash',                              field: 'chem_ubc_fly_ash',      unit: '%' },
            { sn: 148, label: 'Fly Ash Sales (to cement plant)',          field: 'chem_ash_sales_mt',     unit: 'MT' },
        ]
    },
    {
        title: '📝 Miscellaneous',
        rows: [
            { sn: 149, label: 'Hydrogen Cylinders (00:00-24:00)',         field: 'h2_cylinders',          unit: "No's" },
            { sn: 150, label: 'Oxygen Cylinders (00:00-24:00)',           field: 'o2_cylinders',          unit: "No's" },
            { sn: 151, label: 'CTCS Balls Collected from System',         field: 'ctcs_balls_collected',  unit: "No's" },
            { sn: 152, label: 'CTCS Balls Added',                         field: 'ctcs_balls_added',      unit: "No's" },
            { sn: 153, label: 'Small IAC Running Hours',                  field: 'small_iac_hrs',         unit: 'hrs' },
            { sn: 154, label: 'Grid Frequency Max',                       field: 'grid_freq_max',         unit: 'Hz' },
            { sn: 155, label: 'Grid Frequency Min',                       field: 'grid_freq_min',         unit: 'Hz' },
            { sn: 156, label: 'Ambient Temp Max',                         field: 'ambient_temp_max',      unit: '°C' },
            { sn: 157, label: 'Ambient Temp Min',                         field: 'ambient_temp_min',      unit: '°C' },
            { sn: 158, label: 'Relative Humidity Max',                    field: 'humidity_max',          unit: '%' },
            { sn: 159, label: 'Relative Humidity Min',                    field: 'humidity_min',          unit: '%' },
        ]
    },
]

function fmt(val) {
    if (val == null || val === '') return <span style={{ color: '#cbd5e1' }}>—</span>
    if (typeof val === 'number' || (!isNaN(parseFloat(val)) && String(val).trim() !== '')) {
        const n = parseFloat(val)
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    }
    return String(val)
}

function CalSection({ title, rows, data }) {
    return (
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', padding: '10px 16px' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>{title}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '7px 12px', width: 50, textAlign: 'center', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>SN</th>
                        <th style={{ padding: '7px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Particulars</th>
                        <th style={{ padding: '7px 12px', width: 90, textAlign: 'center', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Unit</th>
                        <th style={{ padding: '7px 12px', width: 160, textAlign: 'right', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => {
                        const val = data?.[row.field]
                        const hasValue = val != null && val !== '' && val !== 0
                        return (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                                <td style={{ padding: '7px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: 500, fontSize: 11 }}>{row.sn}</td>
                                <td style={{ padding: '7px 12px', color: '#334155' }}>{row.label}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>{row.unit}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: hasValue ? 700 : 400, color: hasValue ? '#0f172a' : '#cbd5e1' }}>
                                    {fmt(val)}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default function CalView() {
    const { selectedPlant } = usePlant()
    const plantId = selectedPlant?.id
    const isTaqa = selectedPlant?.short_name?.startsWith('TAQA')
    const [date, setDate] = useState(yesterday)

    const { data: entryRes, isLoading, error } = useQuery({
        queryKey: ['taqa-24cal-raw', plantId, date],
        queryFn: () => dataEntry.getTaqaEntry(plantId, date),
        enabled: !!plantId && !!date && !!isTaqa,
        retry: false,
        staleTime: 0,
    })

    const row = entryRes?.data?.data

    const totalRows = CAL_SECTIONS.reduce((a, s) => a + s.rows.length, 0)

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-title">🧮 24 Cal — Daily Station Data</div>
            <div className="page-sub">Raw input data from all {totalRows} fields, matching Excel "24 cal" sheet • {selectedPlant?.name}</div>

            <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Select Date</label>
                        <input className="form-input" type="date" value={date} max={today}
                            onChange={e => setDate(e.target.value)} />
                    </div>
                    {row && Object.keys(row).length > 0 && (
                        <div style={{ fontSize: 12, background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
                            ✅ Data loaded for {date}
                        </div>
                    )}
                </div>
            </div>

            {!plantId || !isTaqa ? (
                <div className="alert alert-info">ℹ️ Select the <strong>TAQA</strong> plant from the sidebar.</div>
            ) : isLoading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>⏳ Loading station data for {date}...</div>
            ) : error || !row ? (
                <div className="alert alert-error">
                    ❌ No data found for <strong>{date}</strong>.<br />
                    <span style={{ fontSize: 12 }}>Imported data range: Apr 2025 → Apr 2026. Select a date within this range, or enter data via Ops Input.</span>
                </div>
            ) : Object.keys(row).length === 0 ? (
                <div className="alert" style={{ background: '#fef9c3', color: '#854d0e', borderLeft: '4px solid #ca8a04' }}>
                    ⚠️ No Ops Input data submitted for {date}. Please enter data via the Ops Input form.
                </div>
            ) : (
                <div>
                    {CAL_SECTIONS.map((section, i) => (
                        <CalSection key={i} title={section.title} rows={section.rows} data={row} />
                    ))}
                </div>
            )}
        </div>
    )
}
