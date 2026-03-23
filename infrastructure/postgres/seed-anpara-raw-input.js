// Seed Anpara raw input data from 'Macro data' sheet into anpara_daily_input
// Column mapping verified against actual Excel structure (0-indexed)
// U1 data: cols 2-7, 22, 37-56
// U2 data: cols 8-13, 23, 57-76
// Station: cols 16, 24-29, 34, 91, 103, 104
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway'
});

const EXCEL_PATH = process.env.ANPARA_EXCEL ||
    'C:/Users/IE-Admin/Desktop/dgr/dgr-platform/_dev_scripts/excel_docs/ANPARA DAILY GENERATION RECORD 2025-26 FINAL version2.xlsm';

const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
};

const excelDateToISO = (v) => {
    if (!v) return null;
    if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    if (typeof v === 'string') return v.slice(0, 10);
    return null;
};

// Excel column index (0-indexed) verified from Macro data sheet
const COL = {
    date:                1,

    // ── Unit 1 ───────────────────────────────────────────────────────────────
    u1_run_hours:        2,
    u1_gen_mu:           3,
    u1_oil_ldo_kl:       4,
    u1_coal_mt:          5,
    u1_dm_water_m3:      6,
    u1_apc_mu:           7,

    // ── Unit 2 ───────────────────────────────────────────────────────────────
    u2_run_hours:        8,
    u2_gen_mu:           9,
    u2_oil_ldo_kl:       10,
    u2_coal_mt:          11,
    u2_dm_water_m3:      12,
    u2_apc_mu:           13,

    // ── Station ───────────────────────────────────────────────────────────────
    net_export_mu:       16,   // AG / Station Net Export
    u1_h2_cylinders:     22,   // U1 H2 (separate column)
    u2_h2_cylinders:     23,   // U2 H2 (separate column)
    coal_received_mt:    24,
    coal_stock_mt:       25,
    ldo_received_kl:     26,
    dc_uppcl_mu:         27,
    sg_mu:               28,
    // col 29: AG same as net_export_mu — skip
    dc_third_party_mu:   34,

    // ── Unit 1 DC Loss & Partial Loading (raw operator input, cols 37-56) ────
    u1_total_dc_loss_mu:   37,
    u1_btl_loss_mu:        38,
    u1_equip_loss_mu:      39,
    u1_planned_loss_mu:    40,
    u1_total_outage_mu:    41,
    u1_trip_loss_mu:       42,
    u1_coal_constraint_mu: 43,
    u1_grid_backing_mu:    44,
    u1_high_freq_mu:       45,
    u1_ramp_down_mu:       46,
    u1_ramp_up_mu:         47,
    u1_ash_handling_mu:    48,
    u1_equip_partial_mu:   49,
    u1_high_coal_mu:       50,
    u1_unit_stab_mu:       51,
    u1_rgmo_mu:            52,
    u1_iex_mu:             53,
    u1_apc_margin_mu:      54,
    // col 55: empty / filler
    u1_no_trips:           56,

    // ── Unit 2 DC Loss & Partial Loading (raw operator input, cols 57-76) ────
    u2_total_dc_loss_mu:   57,
    u2_btl_loss_mu:        58,
    u2_equip_loss_mu:      59,
    u2_total_outage_mu:    60,
    u2_planned_loss_mu:    61,
    u2_trip_loss_mu:       62,
    u2_coal_constraint_mu: 63,
    u2_grid_backing_mu:    64,
    u2_high_freq_mu:       65,
    u2_ramp_down_mu:       66,
    u2_ramp_up_mu:         67,
    u2_ash_handling_mu:    68,
    u2_equip_partial_mu:   69,
    u2_high_coal_mu:       70,
    u2_unit_stab_mu:       71,
    u2_rgmo_mu:            72,
    u2_iex_mu:             73,
    u2_apc_margin_mu:      74,
    // col 75: empty / filler
    u2_no_trips:           76,

    // ── Misc ──────────────────────────────────────────────────────────────────
    raw_water_m3:        91,
    dsm_rs:              103,
    net_saving_rs:       104,
};

async function run() {
    console.log('Reading Excel:', EXCEL_PATH);
    const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });

    const sheet = wb.Sheets['Macro data'];
    if (!sheet) throw new Error('Sheet "Macro data" not found');

    // Data rows start at index 4 (row 5 in Excel: row 0=col numbers, 1=title, 2-3=headers, 4+=data)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const dataRows = rows.slice(4).filter(r => r[COL.date] != null);

    console.log(`Found ${dataRows.length} data rows in Excel`);

    const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'ANPARA'");
    if (!plants.length) throw new Error('ANPARA plant not found in DB');
    const plantId = plants[0].id;
    console.log('Plant ID:', plantId);

    let inserted = 0, skipped = 0, errors = 0;

    for (const row of dataRows) {
        const entryDate = excelDateToISO(row[COL.date]);
        if (!entryDate || entryDate < '2025-04-01') { skipped++; continue; }

        const record = {
            plant_id:              plantId,
            entry_date:            entryDate,

            u1_run_hours:          parseNum(row[COL.u1_run_hours]),
            u1_gen_mu:             parseNum(row[COL.u1_gen_mu]),
            u1_apc_mu:             parseNum(row[COL.u1_apc_mu]),
            u1_coal_mt:            parseNum(row[COL.u1_coal_mt]),
            u1_oil_ldo_kl:         parseNum(row[COL.u1_oil_ldo_kl]),
            u1_dm_water_m3:        parseNum(row[COL.u1_dm_water_m3]),
            u1_h2_cylinders:       parseNum(row[COL.u1_h2_cylinders]),

            u2_run_hours:          parseNum(row[COL.u2_run_hours]),
            u2_gen_mu:             parseNum(row[COL.u2_gen_mu]),
            u2_apc_mu:             parseNum(row[COL.u2_apc_mu]),
            u2_coal_mt:            parseNum(row[COL.u2_coal_mt]),
            u2_oil_ldo_kl:         parseNum(row[COL.u2_oil_ldo_kl]),
            u2_dm_water_m3:        parseNum(row[COL.u2_dm_water_m3]),
            u2_h2_cylinders:       parseNum(row[COL.u2_h2_cylinders]),

            dc_uppcl_mu:           parseNum(row[COL.dc_uppcl_mu]),
            dc_third_party_mu:     parseNum(row[COL.dc_third_party_mu]),
            sg_mu:                 parseNum(row[COL.sg_mu]),
            net_export_mu:         parseNum(row[COL.net_export_mu]),
            coal_received_mt:      parseNum(row[COL.coal_received_mt]),
            coal_stock_mt:         parseNum(row[COL.coal_stock_mt]),
            ldo_received_kl:       parseNum(row[COL.ldo_received_kl]),
            raw_water_m3:          parseNum(row[COL.raw_water_m3]),

            u1_total_dc_loss_mu:   parseNum(row[COL.u1_total_dc_loss_mu]),
            u1_btl_loss_mu:        parseNum(row[COL.u1_btl_loss_mu]),
            u1_equip_loss_mu:      parseNum(row[COL.u1_equip_loss_mu]),
            u1_planned_loss_mu:    parseNum(row[COL.u1_planned_loss_mu]),
            u1_total_outage_mu:    parseNum(row[COL.u1_total_outage_mu]),
            u1_trip_loss_mu:       parseNum(row[COL.u1_trip_loss_mu]),
            u1_coal_constraint_mu: parseNum(row[COL.u1_coal_constraint_mu]),
            u1_grid_backing_mu:    parseNum(row[COL.u1_grid_backing_mu]),
            u1_high_freq_mu:       parseNum(row[COL.u1_high_freq_mu]),
            u1_ramp_down_mu:       parseNum(row[COL.u1_ramp_down_mu]),
            u1_ramp_up_mu:         parseNum(row[COL.u1_ramp_up_mu]),
            u1_ash_handling_mu:    parseNum(row[COL.u1_ash_handling_mu]),
            u1_equip_partial_mu:   parseNum(row[COL.u1_equip_partial_mu]),
            u1_high_coal_mu:       parseNum(row[COL.u1_high_coal_mu]),
            u1_unit_stab_mu:       parseNum(row[COL.u1_unit_stab_mu]),
            u1_rgmo_mu:            parseNum(row[COL.u1_rgmo_mu]),
            u1_iex_mu:             parseNum(row[COL.u1_iex_mu]),
            u1_apc_margin_mu:      parseNum(row[COL.u1_apc_margin_mu]),
            u1_no_trips:           parseNum(row[COL.u1_no_trips]),

            u2_total_dc_loss_mu:   parseNum(row[COL.u2_total_dc_loss_mu]),
            u2_btl_loss_mu:        parseNum(row[COL.u2_btl_loss_mu]),
            u2_equip_loss_mu:      parseNum(row[COL.u2_equip_loss_mu]),
            u2_total_outage_mu:    parseNum(row[COL.u2_total_outage_mu]),
            u2_planned_loss_mu:    parseNum(row[COL.u2_planned_loss_mu]),
            u2_trip_loss_mu:       parseNum(row[COL.u2_trip_loss_mu]),
            u2_coal_constraint_mu: parseNum(row[COL.u2_coal_constraint_mu]),
            u2_grid_backing_mu:    parseNum(row[COL.u2_grid_backing_mu]),
            u2_high_freq_mu:       parseNum(row[COL.u2_high_freq_mu]),
            u2_ramp_down_mu:       parseNum(row[COL.u2_ramp_down_mu]),
            u2_ramp_up_mu:         parseNum(row[COL.u2_ramp_up_mu]),
            u2_ash_handling_mu:    parseNum(row[COL.u2_ash_handling_mu]),
            u2_equip_partial_mu:   parseNum(row[COL.u2_equip_partial_mu]),
            u2_high_coal_mu:       parseNum(row[COL.u2_high_coal_mu]),
            u2_unit_stab_mu:       parseNum(row[COL.u2_unit_stab_mu]),
            u2_rgmo_mu:            parseNum(row[COL.u2_rgmo_mu]),
            u2_iex_mu:             parseNum(row[COL.u2_iex_mu]),
            u2_apc_margin_mu:      parseNum(row[COL.u2_apc_margin_mu]),
            u2_no_trips:           parseNum(row[COL.u2_no_trips]),

            dsm_rs:                parseNum(row[COL.dsm_rs]),
            net_saving_rs:         parseNum(row[COL.net_saving_rs]),
            status:                'submitted',
        };

        const fields = Object.keys(record);
        const values = fields.map(f => record[f]);
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        const setClauses = fields
            .filter(f => f !== 'plant_id' && f !== 'entry_date')
            .map(f => `${f} = EXCLUDED.${f}`)
            .join(', ');

        try {
            await pool.query(
                `INSERT INTO anpara_daily_input (${fields.join(', ')})
                 VALUES (${placeholders})
                 ON CONFLICT (plant_id, entry_date) DO UPDATE SET ${setClauses}, updated_at = NOW()`,
                values
            );
            inserted++;
            if (inserted % 10 === 0) process.stdout.write(`\r  Inserted: ${inserted}`);
        } catch (err) {
            console.error(`\nError on ${entryDate}:`, err.message);
            errors++;
        }
    }

    console.log(`\n\nDone! Inserted/updated: ${inserted}, Skipped (pre-FY): ${skipped}, Errors: ${errors}`);
    await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
