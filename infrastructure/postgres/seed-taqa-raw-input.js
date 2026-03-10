// Seed TAQA raw input data from 'Ops Input' sheet into taqa_daily_input
const XLSX = require('xlsx');
const { Pool } = require('pg');

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

    // Read Ops Input sheet
    const opsSheet = wb.Sheets['Ops Input'];
    const opsData = XLSX.utils.sheet_to_json(opsSheet, { header: 1 });

    // Read Chem Input sheet
    const chemSheet = wb.Sheets['Chem Input'];
    const chemData = chemSheet ? XLSX.utils.sheet_to_json(chemSheet, { header: 1 }) : [];

    const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TAQA'");
    if (!plants.length) throw new Error('TAQA plant not found in DB');
    const plantId = plants[0].id;

    const parseNum = (val) => {
        if (val === null || val === undefined || val === '') return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
    };

    const excelDateToISO = (v) => {
        if (typeof v === 'number') {
            const d = XLSX.SSF.parse_date_code(v);
            return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
        return null;
    };

    // Ops Input sheet: Row 0 = headers, Row 1 = dates
    // Row mapping: row index -> field name (0-indexed column B = column index 1 has SN, col 2 has label)
    // Data starts from column 3 onwards (one per day)
    // The Excel row number = array index + 1

    // Map SN number (row in Ops Input) to DB column name
    // Based on the migration_taqa_input_table.sql comments
    const OPS_ROW_MAP = {
        // HFO Tanks (rows in Ops Input sheet, 0-indexed from data array)
        2: 'hfo_t10_lvl_calc',      // SN1
        3: 'hfo_t10_lvl_panel',     // SN2
        4: 'hfo_t10_lvl_radar',     // SN3
        5: 'hfo_t10_temp',          // SN4
        6: 'hfo_t20_lvl_calc',      // SN5
        7: 'hfo_t20_lvl_panel',     // SN6
        8: 'hfo_t20_lvl_radar',     // SN7
        9: 'hfo_t20_temp',          // SN8
        10: 'hfo_receipt_mt',       // SN9
        11: 'hfo_supply_int_rdg',   // SN10
        12: 'hfo_return_int_rdg',   // SN11
        // HSD Tanks
        13: 'hsd_t30_lvl',          // SN12
        14: 'hsd_t30_receipt_kl',   // SN13
        15: 'hsd_t40_lvl',          // SN14
        16: 'hsd_t40_receipt_kl',   // SN15
        // Lignite
        17: 'lignite_bc1_int_rdg',  // SN16
        18: 'lignite_receipt_taqa_wb', // SN17
        19: 'lignite_lifted_nlcil_wb', // SN18
        20: 'lignite_vadallur_silo',   // SN19
        21: 'lignite_conv_1a_int_rdg', // SN20
        22: 'lignite_conv_1b_int_rdg', // SN21
        23: 'lignite_direct_feed',     // SN22
        24: 'lignite_bunker_lvl',      // SN23
        25: 'fuel_master_250mw',       // SN24
        26: 'fuel_master_170mw',       // SN25
        // Meter Readings
        27: 'peram_imp_main',       // SN26
        28: 'peram_exp_main',       // SN27
        29: 'peram_imp_check',      // SN28
        30: 'peram_exp_check',      // SN29
        31: 'deviak_imp_main',      // SN30
        32: 'deviak_exp_main',      // SN31
        33: 'deviak_imp_check',     // SN32
        34: 'deviak_exp_check',     // SN33
        35: 'cuddal_imp_main',     // SN34
        36: 'cuddal_exp_main',     // SN35
        37: 'cuddal_imp_check',    // SN36
        38: 'cuddal_exp_check',    // SN37
        39: 'nlc2_imp_main',       // SN38
        40: 'nlc2_exp_main',       // SN39
        41: 'nlc2_imp_check',      // SN40
        42: 'nlc2_exp_check',      // SN41
        43: 'net_import_sy',       // SN42
        44: 'import_uat',          // SN43
        45: 'net_export',          // SN44
        46: 'schedule_gen_mldc',   // SN45
        47: 'gen_main_meter',      // SN46
        48: 'gen_check_meter',     // SN47
        49: 'uat1_main_rdg',       // SN48
        50: 'uat1_check_rdg',      // SN49
        51: 'uat2_main_rdg',       // SN50
        52: 'uat2_check_rdg',      // SN51
        53: 'gt_bay_imp_rdg',      // SN52
        54: 'gt_bay_exp_rdg',      // SN53
        // Generation / Scheduling
        55: 'declared_capacity_mwhr', // SN54
        56: 'deemed_gen_mwhr',       // SN55
        57: 'dispatch_demand_mwhr',  // SN56
        // Outages / Hours
        58: 'no_unit_trips',         // SN57
        59: 'no_unit_shutdown',      // SN58
        60: 'dispatch_duration',     // SN59
        61: 'load_backdown_duration', // SN60
        62: 'unit_standby_hrs',      // SN61
        63: 'scheduled_outage_hrs',  // SN62
        64: 'forced_outage_hrs',     // SN63
        65: 'derated_outage_hrs',    // SN64
        66: 'total_hours',           // SN65
        67: 'no_load_pickup_inst',   // SN66
        68: 'no_load_backdown_inst', // SN67
        // DSM
        69: 'dsm_charges',          // SN68
        70: 'net_gain_loss',        // SN69
        71: 'fuel_saved_loss',      // SN70
        // Water Tank Levels - may start later
        73: 'reservoir1_lvl',       // SN72
        74: 'reservoir2_lvl',       // SN73
        75: 'dm_storage_tank_lvl',  // SN74
        76: 'potable_tank_lvl',     // SN75
        77: 'reserve_condensate_lvl', // SN76
        78: 'boiler_condensate_lvl',  // SN77
        79: 'condensate_drain_lvl',   // SN78
        // Water Integrators
        80: 'dm_water_prod_m3',     // SN79
        81: 'borewell_to_reservoir', // SN80
        82: 'borewell_to_cw_forebay', // SN81
        83: 'reservoir_to_cw_forebay', // SN82
        84: 'cmb_to_cw_forebay',    // SN83
        85: 'cw_blowdown',          // SN84
        86: 'cw_blowdown_to_ahp',   // SN85
        87: 'cw_blowdown_to_village', // SN86
        88: 'service_water_flow',    // SN87
        89: 'seal_water_supply',     // SN88
        90: 'seal_water_return',     // SN89
        91: 'raw_water_to_dm',       // SN90
        92: 'potable_tank_makeup',   // SN91
        93: 'dm_to_condenser',       // SN92
        94: 'cst_to_main_unit',      // SN93
        95: 'stp_inlet_flow',        // SN94
        96: 'stp_treated_flow',      // SN95
        97: 'firefighting_flow',     // SN96
        98: 'village_water1',        // SN97
        99: 'village_water2',        // SN98
        100: 'ash_pond_overflow',    // SN99
        // LHP / Mill Hours
        101: 'lhp_conv_1a_hrs',      // SN100
        102: 'lhp_conv_1b_hrs',      // SN101
        103: 'lhp_autosampler_hrs',  // SN102
        104: 'lhp_dss_pump1_hrs',    // SN103
        105: 'lhp_dss_pump2_hrs',    // SN104
        106: 'ff_hydrant_201_hrs',   // SN105
        107: 'ff_spray_301_hrs',     // SN106
        108: 'mill10_hrs',           // SN107
        109: 'mill20_hrs',           // SN108
        110: 'mill30_hrs',           // SN109
        111: 'mill40_hrs',           // SN110
        112: 'mill50_hrs',           // SN111
        113: 'mill60_hrs',           // SN112
        // Equipment kWh
        114: 'bfp1_kwh',            // SN113
        115: 'bfp2_kwh',            // SN114
        116: 'bfp3_kwh',            // SN115
        117: 'mcwp1_kwh',           // SN116
        118: 'mcwp2_kwh',           // SN117
        119: 'mcwp3_kwh',           // SN118
        120: 'cep1_kwh',            // SN119
        121: 'cep2_kwh',            // SN120
        122: 'fdf1_kwh',            // SN121
        123: 'fdf2_kwh',            // SN122
        124: 'iac1_kwh',            // SN123
        125: 'iac2_kwh',            // SN124
        126: 'iac3_kwh',            // SN125
        127: 'cac1_kwh',            // SN126
        128: 'cac2_kwh',            // SN127
        129: 'cac3_kwh',            // SN128
        130: 'lhp_inc1_kwh',        // SN129
        131: 'lhp_inc2_kwh',        // SN130
        132: 'ff_spray_201_kwh',    // SN131
        133: 'ff_hydrant_301_kwh',  // SN132
        134: 'stp_kwh',             // SN133
        // Ash
        135: 'ba_trucks_internal',  // SN134
        136: 'ba_trucks_external',  // SN135
        137: 'fa_silo_lvl_pct',     // SN136
        138: 'fa_trucks',           // SN137
        139: 'fa_to_ash_pond_mt',   // SN138
        140: 'ahp_rot_feed1_hrs',   // SN139
        141: 'ahp_rot_feed2_hrs',   // SN140
        142: 'ash_tx_outage_hrs',   // SN141
        // Misc
        143: 'h2_cylinders',        // SN142
        144: 'o2_cylinders',        // SN143
        145: 'ctcs_balls_collected', // SN144
        146: 'ctcs_balls_added',    // SN145
        147: 'small_iac_hrs',       // SN146
        // 148 = day_highlights (text)
        149: 'grid_freq_max',       // SN148
        150: 'grid_freq_min',       // SN149
        151: 'ambient_temp_max',    // SN150
        152: 'ambient_temp_min',    // SN151
        153: 'humidity_max',        // SN152
        154: 'humidity_min',        // SN153
        // 155 = grid_disturbance (text)
    };

    // Chem Input rows
    const CHEM_ROW_MAP = {
        2: 'chem_ash_sales_mt',    // CH1
        3: 'chem_ash_pct',         // CH2
        4: 'chem_gcv_nlcil',       // CH3
        5: 'chem_ubc_bottom_ash',  // CH4
        6: 'chem_ubc_fly_ash',     // CH5
    };

    // Find date row (first row typically has dates starting from column 3)
    const datesRow = opsData[1]; // Row 2 in Excel (0-indexed row 1) typically has dates

    // Let's detect where dates are
    let dateRowIdx = -1;
    for (let r = 0; r < Math.min(5, opsData.length); r++) {
        const row = opsData[r];
        if (!row) continue;
        for (let c = 2; c < 10; c++) {
            if (typeof row[c] === 'number' && row[c] > 40000 && row[c] < 50000) {
                dateRowIdx = r;
                break;
            }
        }
        if (dateRowIdx >= 0) break;
    }

    if (dateRowIdx < 0) {
        console.error('Could not find date row in Ops Input sheet');
        // Print first few rows for debugging
        for (let r = 0; r < 5; r++) {
            console.log(`Row ${r}:`, opsData[r]?.slice(0, 8));
        }
        return;
    }

    console.log(`Found dates in row ${dateRowIdx}`);
    const dates = opsData[dateRowIdx];

    let importedCount = 0;
    const startCol = 3; // Data typically starts from column D (index 3)

    // Find the actual start column with dates
    let actualStartCol = startCol;
    for (let c = 1; c < 10; c++) {
        if (typeof dates[c] === 'number' && dates[c] > 40000) {
            actualStartCol = c;
            break;
        }
    }

    console.log(`Data starts at column ${actualStartCol}`);

    for (let c = actualStartCol; c < dates.length; c++) {
        const dateStr = excelDateToISO(dates[c]);
        if (!dateStr) continue;

        // Build the field values object
        const fields = {};
        const values = [];
        const fieldNames = [];

        // Ops Input fields
        for (const [rowIdx, colName] of Object.entries(OPS_ROW_MAP)) {
            const row = opsData[parseInt(rowIdx)];
            if (row) {
                const val = parseNum(row[c]);
                fields[colName] = val;
                fieldNames.push(colName);
                values.push(val);
            }
        }

        // Chem Input fields
        if (chemData.length > 0) {
            for (const [rowIdx, colName] of Object.entries(CHEM_ROW_MAP)) {
                const row = chemData[parseInt(rowIdx)];
                if (row) {
                    const val = parseNum(row[c]);
                    fields[colName] = val;
                    fieldNames.push(colName);
                    values.push(val);
                }
            }
        }

        // Text fields
        const dayHighlightsRow = opsData[148];
        if (dayHighlightsRow && dayHighlightsRow[c]) {
            fieldNames.push('day_highlights');
            values.push(String(dayHighlightsRow[c]));
        }

        const gridDisturbRow = opsData[155];
        if (gridDisturbRow && gridDisturbRow[c]) {
            fieldNames.push('grid_disturbance');
            values.push(String(gridDisturbRow[c]));
        }

        if (fieldNames.length === 0) continue;

        const placeholders = fieldNames.map((_, i) => `$${i + 3}`).join(', ');
        const setClauses = fieldNames.map((f, i) => `${f} = $${i + 3}`).join(', ');

        try {
            await pool.query(
                `INSERT INTO taqa_daily_input (plant_id, entry_date, ${fieldNames.join(', ')}, status)
                 VALUES ($1, $2, ${placeholders}, 'approved')
                 ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                   ${setClauses}, status = 'approved', updated_at = NOW()`,
                [plantId, dateStr, ...values]
            );
            importedCount++;
        } catch (err) {
            console.error(`Error seeding date ${dateStr}:`, err.message);
            if (err.message.includes('overflow')) {
                // Find which value might be the culprit
                fieldNames.forEach((name, i) => {
                    const val = values[i];
                    if (typeof val === 'number' && Math.abs(val) > 1000000) {
                        console.log(`  Potential overflow: ${name} = ${val}`);
                    }
                });
            }
        }
    }

    console.log(`Successfully seeded ${importedCount} days of raw TAQA input data into taqa_daily_input.`);
    await pool.end();
}

run().catch(err => { console.error(err); pool.end(); });
