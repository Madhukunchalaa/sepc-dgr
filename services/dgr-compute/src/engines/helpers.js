const { query } = require('../shared/db');

const allNumericCols = [
    'hfo_t10_lvl_calc', 'hfo_t10_lvl_panel', 'hfo_t10_lvl_radar', 'hfo_t10_temp',
    'hfo_t20_lvl_calc', 'hfo_t20_lvl_panel', 'hfo_t20_lvl_radar', 'hfo_t20_temp',
    'hfo_receipt_mt', 'hfo_supply_int_rdg', 'hfo_return_int_rdg',
    'hsd_t30_lvl', 'hsd_t30_receipt_kl', 'hsd_t40_lvl', 'hsd_t40_receipt_kl',
    'lignite_bc1_int_rdg', 'lignite_receipt_taqa_wb', 'lignite_lifted_nlcil_wb',
    'lignite_vadallur_silo', 'lignite_conv_1a_int_rdg', 'lignite_conv_1b_int_rdg',
    'lignite_direct_feed', 'lignite_bunker_lvl', 'fuel_master_250mw', 'fuel_master_170mw',
    'peram_imp_main', 'peram_exp_main', 'peram_imp_check', 'peram_exp_check',
    'deviak_imp_main', 'deviak_exp_main', 'deviak_imp_check', 'deviak_exp_check',
    'cuddal_imp_main', 'cuddal_exp_main', 'cuddal_imp_check', 'cuddal_exp_check',
    'nlc2_imp_main', 'nlc2_exp_main', 'nlc2_imp_check', 'nlc2_exp_check',
    'net_import_sy', 'import_uat', 'net_export', 'schedule_gen_mldc',
    'gen_main_meter', 'gen_check_meter', 'uat1_main_rdg', 'uat1_check_rdg',
    'uat2_main_rdg', 'uat2_check_rdg', 'gt_bay_imp_rdg', 'gt_bay_exp_rdg',
    'declared_capacity_mwhr', 'deemed_gen_mwhr', 'dispatch_demand_mwhr',
    'no_unit_trips', 'no_unit_shutdown', 'dispatch_duration', 'load_backdown_duration',
    'unit_standby_hrs', 'scheduled_outage_hrs', 'forced_outage_hrs', 'derated_outage_hrs',
    'total_hours', 'no_load_pickup_inst', 'no_load_backdown_inst',
    'dsm_charges', 'net_gain_loss', 'fuel_saved_loss',
    'reservoir1_lvl', 'reservoir2_lvl', 'dm_storage_tank_lvl', 'potable_tank_lvl',
    'reserve_condensate_lvl', 'boiler_condensate_lvl', 'condensate_drain_lvl',
    'dm_water_prod_m3', 'borewell_to_reservoir', 'borewell_to_cw_forebay',
    'reservoir_to_cw_forebay', 'cmb_to_cw_forebay', 'cw_blowdown', 'cw_blowdown_to_ahp',
    'cw_blowdown_to_village', 'service_water_flow', 'seal_water_supply',
    'seal_water_return', 'raw_water_to_dm', 'potable_tank_makeup', 'dm_to_condenser',
    'cst_to_main_unit', 'stp_inlet_flow', 'stp_treated_flow', 'firefighting_flow',
    'village_water1', 'village_water2', 'ash_pond_overflow',
    'lhp_conv_1a_hrs', 'lhp_conv_1b_hrs', 'lhp_autosampler_hrs', 'lhp_dss_pump1_hrs',
    'lhp_dss_pump2_hrs', 'ff_hydrant_201_hrs', 'ff_spray_301_hrs',
    'mill10_hrs', 'mill20_hrs', 'mill30_hrs', 'mill40_hrs', 'mill50_hrs', 'mill60_hrs',
    'bfp1_kwh', 'bfp2_kwh', 'bfp3_kwh', 'mcwp1_kwh', 'mcwp2_kwh', 'mcwp3_kwh',
    'cep1_kwh', 'cep2_kwh', 'fdf1_kwh', 'fdf2_kwh', 'iac1_kwh', 'iac2_kwh', 'iac3_kwh',
    'cac1_kwh', 'cac2_kwh', 'cac3_kwh', 'lhp_inc1_kwh', 'lhp_inc2_kwh',
    'ff_spray_201_kwh', 'ff_hydrant_301_kwh', 'stp_kwh',
    'ba_trucks_internal', 'ba_trucks_external', 'fa_silo_lvl_pct', 'fa_trucks',
    'fa_to_ash_pond_mt', 'ahp_rot_feed1_hrs', 'ahp_rot_feed2_hrs', 'ash_tx_outage_hrs',
    'h2_cylinders', 'o2_cylinders', 'ctcs_balls_collected', 'ctcs_balls_added',
    'small_iac_hrs', 'grid_freq_max', 'grid_freq_min',
    'ambient_temp_max', 'ambient_temp_min', 'humidity_max', 'humidity_min',
    'chem_ash_sales_mt', 'chem_ash_pct', 'chem_gcv_nlcil', 'chem_ubc_bottom_ash', 'chem_ubc_fly_ash'
];

async function getPlant(plantId) {
    const { rows } = await query(
        `SELECT *, 
            CASE 
              WHEN EXTRACT(MONTH FROM NOW()) >= fy_start_month 
              THEN EXTRACT(YEAR FROM NOW())::TEXT || '-' || (EXTRACT(YEAR FROM NOW())+1)::TEXT
              ELSE (EXTRACT(YEAR FROM NOW())-1)::TEXT || '-' || EXTRACT(YEAR FROM NOW())::TEXT
            END AS fy_label
     FROM plants WHERE id = $1`, [plantId]
    );
    return rows[0];
}

async function getPowerData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_power WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getFuelData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_fuel WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getPerfData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_performance WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getWaterData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_water WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getAshData(plantId, date) {
    try {
        const { rows } = await query(`SELECT * FROM daily_ash WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
        return rows[0];
    } catch (e) { return {} }
}

async function getDsmData(plantId, date) {
    try {
        const { rows } = await query(`SELECT * FROM daily_dsm WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
        return rows[0];
    } catch (e) { return {} }
}

async function getAvailabilityData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_availability WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getSchedulingData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_scheduling WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getOpsLog(plantId, date) {
    const { rows } = await query(`SELECT * FROM operations_log WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}

async function getSubmissionStatus(plantId, date) {
    const { rows } = await query(
        `SELECT module, status, submitted_at, approved_at FROM submission_status
     WHERE plant_id=$1 AND entry_date=$2 ORDER BY module`, [plantId, date]
    );
    return rows;
}

async function getFYStartDate(plantId, date) {
    const { rows } = await query(`SELECT fy_start_month FROM plants WHERE id=$1`, [plantId]);
    const m = rows[0]?.fy_start_month || 4;
    const d = new Date(date);
    const y = (d.getMonth() + 1) >= m ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-${String(m).padStart(2, '0')}-01`;
}

async function getMTDSum(plantId, date, col, table = 'daily_power') {
    const { rows } = await query(
        `SELECT SUM(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND DATE_TRUNC('month',entry_date)=DATE_TRUNC('month',$2::date)
       AND entry_date<=$2::date AND status IN ('draft','submitted','approved','locked')`,
        [plantId, date]
    );
    return rows[0]?.val || 0;
}

async function getYTDSum(plantId, date, col, table = 'daily_power') {
    const fyStart = await getFYStartDate(plantId, date);
    const { rows } = await query(
        `SELECT SUM(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND entry_date>=$2::date AND entry_date<=$3::date
       AND status IN ('draft','submitted','approved','locked')`,
        [plantId, fyStart, date]
    );
    return rows[0]?.val || 0;
}

async function getMTDAvg(plantId, date, col, table = 'daily_power') {
    const { rows } = await query(
        `SELECT AVG(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND DATE_TRUNC('month',entry_date)=DATE_TRUNC('month',$2::date)
       AND entry_date<=$2::date AND status IN ('draft','submitted','approved','locked')`,
        [plantId, date]
    );
    return rows[0]?.val || 0;
}

async function getYTDAvg(plantId, date, col, table = 'daily_power') {
    const fyStart = await getFYStartDate(plantId, date);
    const { rows } = await query(
        `SELECT AVG(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND entry_date>=$2::date AND entry_date<=$3::date
       AND status IN ('draft','submitted','approved','locked')`,
        [plantId, fyStart, date]
    );
    return rows[0]?.val || 0;
}

function processNumbers(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'number') return obj != null ? Number(obj.toFixed(4)) : null;
    if (Array.isArray(obj)) return obj.map(processNumbers);
    if (typeof obj === 'object') {
        const newObj = {};
        for (const [k, v] of Object.entries(obj)) {
            newObj[k] = processNumbers(v);
        }
        return newObj;
    }
    return obj;
}

async function getTaqaStats(plantId, date) {
    const fyStart = await getFYStartDate(plantId, date);
    const mtdQuery = `
        SELECT 
            'mtd' as type,
            COUNT(*) as days,
            ${allNumericCols.map(c => `SUM(${c}) as ${c}`).join(',\n            ')}
        FROM taqa_daily_input
        WHERE plant_id=$1 AND DATE_TRUNC('month',entry_date)=DATE_TRUNC('month',$2::date)
          AND entry_date<=$2::date AND status IN ('draft','submitted','approved')
    `;
    const ytdQuery = `
        SELECT 
            'ytd' as type,
            COUNT(*) as days,
            ${allNumericCols.map(c => `SUM(${c}) as ${c}`).join(',\n            ')}
        FROM taqa_daily_input
        WHERE plant_id=$1 AND entry_date>=$2::date AND entry_date<=$3::date
          AND status IN ('draft','submitted','approved')
    `;

    const [mtdRes, ytdRes] = await Promise.all([
        query(mtdQuery, [plantId, date]),
        query(ytdQuery, [plantId, fyStart, date])
    ]);

    return { mtd: mtdRes.rows[0], ytd: ytdRes.rows[0] };
}

module.exports = {
    getPlant, getPowerData, getFuelData, getPerfData, getWaterData,
    getAshData, getDsmData, getAvailabilityData, getSchedulingData,
    getOpsLog, getSubmissionStatus, getFYStartDate, getMTDSum,
    getYTDSum, getMTDAvg, getYTDAvg, getTaqaStats, processNumbers, query
};
