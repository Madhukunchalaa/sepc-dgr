const fs = require('fs');
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({ user: 'dgr_user', password: '1234', database: 'dgr_platform', port: 5432 });

async function run() {
    const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');
    const ws = wb.Sheets['Power'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const { rows: pRows } = await pool.query("SELECT id FROM plants WHERE short_name='TTPP' LIMIT 1");
    if (!pRows.length) return;
    const plantId = pRows[0].id;

    for (let r = 5; r < data.length; r++) {
        const d = data[r][0];
        if (typeof d === 'number') {
            const dt = XLSX.SSF.parse_date_code(d);
            const dateStr = `${dt.y}-${String(dt.m).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`;

            const paf_sepc = data[r][73] != null ? Number(data[r][73]) : null;
            const paf_tnpdcl = data[r][121] != null ? Number(data[r][121]) : null;

            if (paf_sepc != null || paf_tnpdcl != null) {
                await pool.query(`
                    INSERT INTO daily_availability (plant_id, entry_date, paf_pct, paf_tnpdcl, status)
                    VALUES ($1, $2, $3, $4, 'approved')
                    ON CONFLICT (plant_id, entry_date) 
                    DO UPDATE SET paf_pct = EXCLUDED.paf_pct, paf_tnpdcl = EXCLUDED.paf_tnpdcl, status = 'approved'
                `, [plantId, dateStr, paf_sepc, paf_tnpdcl]);
            }
        }
    }
    console.log("Local database filled with PAF!");
    process.exit(0);
}

run();
