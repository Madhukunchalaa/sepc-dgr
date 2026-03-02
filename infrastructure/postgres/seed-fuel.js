const XLSX = require('xlsx');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: process.env.DB_PORT || 5432,
});

async function run() {
    const filePath = path.join(__dirname, '../../DGR FY 2025-20261 - V1 (1).xlsx');
    console.log(`Reading ${filePath}...`);

    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames.find(s => s.toLowerCase() === 'dgr' || s.includes('05-Feb'));
    const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Extracted coordinates for 05-Feb-2026
    const parseNum = (val) => {
        if (!val) return 0;
        const str = String(val).split('/')[0].trim();
        return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
    };

    const coal_receipt_mt = parseNum(data[34]?.[3]);   // Row 34, Col D
    const coal_cons_mt = parseNum(data[17]?.[28]) * 100000 || 0; // LMT * 100,000 = MT
    const coal_stock_mt = parseNum(data[37]?.[7]) / 100 || 532317; // Adjusting magnitude if needed

    const ldo_receipt_kl = parseNum(data[32]?.[5]);
    const ldo_cons_kl = parseNum(data[29]?.[5]);
    const ldo_stock_kl = parseNum(data[35]?.[3]);

    const hfo_receipt_kl = parseNum(data[33]?.[5]);
    const hfo_cons_kl = parseNum(data[30]?.[5]);
    const hfo_stock_kl = parseNum(data[36]?.[3]);

    const coal_gcv_ar = parseNum(data[27]?.[11]);
    const coal_gcv_af = parseNum(data[27]?.[3]);

    // Insert into DB
    try {
        const { rows: plants } = await pool.query(`SELECT id FROM plants WHERE short_name = 'TTPP' OR short_name = 'TEST' LIMIT 1`);
        if (!plants.length) throw new Error('No plant found');
        const plantId = plants[0].id;

        // Use a fixed date for this seed since the Excel is for 05-Feb-2026
        const entryDate = '2026-02-05';

        console.log(`Inserting Fuel Data for Plant ${plantId} on ${entryDate}`);
        const query = `
      INSERT INTO daily_fuel (
        plant_id, entry_date,
        coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af,
        ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
        hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl,
        status
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        'approved'
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        coal_receipt_mt = EXCLUDED.coal_receipt_mt,
        coal_cons_mt = EXCLUDED.coal_cons_mt,
        coal_stock_mt = EXCLUDED.coal_stock_mt,
        coal_gcv_ar = EXCLUDED.coal_gcv_ar,
        coal_gcv_af = EXCLUDED.coal_gcv_af,
        ldo_receipt_kl = EXCLUDED.ldo_receipt_kl,
        ldo_cons_kl = EXCLUDED.ldo_cons_kl,
        ldo_stock_kl = EXCLUDED.ldo_stock_kl,
        hfo_receipt_kl = EXCLUDED.hfo_receipt_kl,
        hfo_cons_kl = EXCLUDED.hfo_cons_kl,
        hfo_stock_kl = EXCLUDED.hfo_stock_kl,
        status = 'approved',
        updated_at = NOW()
      RETURNING *;
    `;
        const res = await pool.query(query, [
            plantId, entryDate,
            coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af,
            ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
            hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl
        ]);

        console.log('Inserted:', JSON.stringify(res.rows[0], null, 2));

        // Also trigger the engine computation logic to just show it works
        const { rows: pw } = await pool.query(`SELECT export_mu FROM daily_power WHERE plant_id=$1 AND entry_date=$2`, [plantId, entryDate]);
        const exportKwh = (pw[0]?.export_mu || 0) * 1000000;
        const coalKg = (coal_cons_mt || 0) * 1000;
        const sccKgKwh = exportKwh > 0 ? coalKg / exportKwh : null;

        await pool.query(`UPDATE daily_fuel SET scc_kg_kwh = $1 WHERE plant_id=$2 AND entry_date=$3`, [sccKgKwh, plantId, entryDate]);
        console.log(`Updated SCC: ${sccKgKwh} kg/kWh`);

    } catch (err) {
        console.error('Error seeding fuel:', err);
    } finally {
        pool.end();
    }
}

run();
