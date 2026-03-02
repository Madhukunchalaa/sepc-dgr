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

    const faData = XLSX.utils.sheet_to_json(wb.Sheets['Fuel & Ash'], { header: 1 });
    const perfData = XLSX.utils.sheet_to_json(wb.Sheets['Perf'], { header: 1 });
    const sapData = XLSX.utils.sheet_to_json(wb.Sheets['SAP'], { header: 1 });

    const parseNum = (val) => {
        if (!val) return 0;
        const str = String(val).split('/')[0].trim();
        return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
    };

    try {
        const { rows: plants } = await pool.query(`SELECT id FROM plants WHERE short_name = 'TTPP' OR short_name = 'TEST' LIMIT 1`);
        if (!plants.length) throw new Error('No plant found');
        const plantId = plants[0].id;

        console.log(`Starting historical import for Plant ${plantId}...`);

        let importedCount = 0;

        // Iterate starting from row 6 (2025-04-01) up to row 316 (2026-02-05) in Fuel & Ash
        for (let r = 6; r <= 316; r++) {
            const faRow = faData[r] || [];
            if (!faRow[0]) continue;

            const dateObj = XLSX.SSF.parse_date_code(faRow[0]);
            if (!dateObj) continue;
            const entryDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;

            // It's possible Perf and SAP don't perfectly align by row number, so we search them by date
            let perfRow = [];
            for (let pr = 6; pr < perfData.length; pr++) {
                const pRow = perfData[pr] || [];
                if (pRow[0] === faRow[0]) {
                    perfRow = pRow;
                    break;
                }
            }

            let sapRow = [];
            for (let sr = 3; sr < sapData.length; sr++) {
                const sRow = sapData[sr] || [];
                if (sRow[0] === faRow[0]) {
                    sapRow = sRow;
                    break;
                }
            }

            // Parse values
            // Fuel & Ash: LDO (Receipt=1, Cons=7, Stock=10), HFO (Receipt=12, Cons=18, Stock=21), Coal (Receipt=25, Cons=28, Stock=31)
            const ldo_receipt_kl = parseNum(faRow[1]);
            const ldo_cons_kl = parseNum(faRow[7]);
            const ldo_stock_kl = parseNum(faRow[10]);

            const hfo_receipt_kl = parseNum(faRow[12]);
            const hfo_cons_kl = parseNum(faRow[18]);
            const hfo_stock_kl = parseNum(faRow[21]);

            const coal_receipt_mt = parseNum(faRow[25]);
            const coal_cons_mt = parseNum(faRow[28]);
            const coal_stock_mt = parseNum(faRow[31]);

            // Perf: GCV AR=1, GCV AF=5
            const coal_gcv_ar = parseNum(perfRow[1]);
            const coal_gcv_af = parseNum(perfRow[5]);

            // SAP: H2 Cons=14
            const h2_cons = parseNum(sapRow[14]);

            // SCC and SOC need generation_mu
            const { rows: pw } = await pool.query(`SELECT generation_mu FROM daily_power WHERE plant_id=$1 AND entry_date=$2`, [plantId, entryDate]);
            const genMu = (pw[0]?.generation_mu || 0);
            const genKwh = genMu * 1000000;

            const coalKg = coal_cons_mt * 1000;
            const scc_kg_kwh = genKwh > 0 ? coalKg / genKwh : null;
            const soc_ml_kwh = genMu > 0 ? (ldo_cons_kl + hfo_cons_kl) / genMu : null;

            const query = `
         INSERT INTO daily_fuel (
           plant_id, entry_date,
           coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af, scc_kg_kwh,
           ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
           hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl,
           soc_ml_kwh,
           h2_cons,
           status
         ) VALUES (
           $1, $2,
           $3, $4, $5, $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14,
           $15,
           $16,
           'approved'
         ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
           coal_receipt_mt = EXCLUDED.coal_receipt_mt,
           coal_cons_mt = EXCLUDED.coal_cons_mt,
           coal_stock_mt = EXCLUDED.coal_stock_mt,
           coal_gcv_ar = EXCLUDED.coal_gcv_ar,
           coal_gcv_af = EXCLUDED.coal_gcv_af,
           scc_kg_kwh = EXCLUDED.scc_kg_kwh,
           ldo_receipt_kl = EXCLUDED.ldo_receipt_kl,
           ldo_cons_kl = EXCLUDED.ldo_cons_kl,
           ldo_stock_kl = EXCLUDED.ldo_stock_kl,
           hfo_receipt_kl = EXCLUDED.hfo_receipt_kl,
           hfo_cons_kl = EXCLUDED.hfo_cons_kl,
           hfo_stock_kl = EXCLUDED.hfo_stock_kl,
           soc_ml_kwh = EXCLUDED.soc_ml_kwh,
           h2_cons = EXCLUDED.h2_cons,
           status = 'approved',
           updated_at = NOW()
       `;

            await pool.query(query, [
                plantId, entryDate,
                coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af, scc_kg_kwh,
                ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
                hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl,
                soc_ml_kwh,
                h2_cons
            ]);

            importedCount++;
        }

        console.log(`Successfully imported/updated ${importedCount} historical fuel records.`);

    } catch (err) {
        console.error('Error seeding fuel history:', err);
    } finally {
        pool.end();
    }
}

run();
