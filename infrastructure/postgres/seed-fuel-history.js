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

    const faData = XLSX.utils.sheet_to_json(wb.Sheets['Fuel & Ash'], { header: 1, defval: null });
    const perfData = XLSX.utils.sheet_to_json(wb.Sheets['Perf'], { header: 1, defval: null });
    const sapData = XLSX.utils.sheet_to_json(wb.Sheets['SAP'], { header: 1, defval: null });

    // Dynamic extraction logic for Fuel & Ash table:
    let ldoReceipt = -1, ldoCons = -1, ldoStock = -1;
    let hfoReceipt = -1, hfoCons = -1, hfoStock = -1;
    let coalReceipt = -1, coalCons = -1, coalStock = -1;

    if (faData.length > 3) {
        const row2 = faData[2];  // LDO, HFO, Coal main groups
        const row3 = faData[3];  // Daily Receipt, Daily Cons., Stock
        let currentCategory = '';

        for (let i = 0; i < row3.length; i++) {
            if (i > 100) break;
            const topLabel = String(row2[i] || '').trim();
            if (topLabel === 'LDO') currentCategory = 'LDO';
            if (topLabel === 'HFO') currentCategory = 'HFO';
            if (topLabel === 'Coal') currentCategory = 'Coal';

            const subLabel = String(row3[i] || '').trim();

            if (currentCategory === 'LDO') {
                if (subLabel === 'Daily Receipt' && ldoReceipt === -1) ldoReceipt = i;
                if (subLabel === 'Daily Cons.' && ldoCons === -1) ldoCons = i;
                if (subLabel === 'Stock' && ldoStock === -1) ldoStock = i;
            }
            if (currentCategory === 'HFO') {
                if ((subLabel === 'Daily Receipt' || subLabel === 'Receipt') && hfoReceipt === -1) hfoReceipt = i;
                if (subLabel === 'Daily Cons.' && hfoCons === -1) hfoCons = i;
                if (subLabel === 'Stock' && hfoStock === -1) hfoStock = i;
            }
            if (currentCategory === 'Coal') {
                if (subLabel === 'Daily Receipt' && coalReceipt === -1) coalReceipt = i;
                if (subLabel === 'Daily Cons.' && coalCons === -1) coalCons = i;
                if (subLabel === 'Stock' && coalStock === -1) coalStock = i;
            }
        }
    }

    if (ldoReceipt === -1) ldoReceipt = 1;
    if (ldoCons === -1) ldoCons = 7;
    if (ldoStock === -1) ldoStock = 10;
    if (hfoReceipt === -1) hfoReceipt = 12;
    if (hfoCons === -1) hfoCons = 18;
    if (hfoStock === -1) hfoStock = 21;
    if (coalReceipt === -1) coalReceipt = 25;
    if (coalCons === -1) coalCons = 28;
    if (coalStock === -1) coalStock = 31;

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
            // Fuel & Ash dynamic variable extraction
            const ldo_receipt_kl = parseNum(faRow[ldoReceipt]);
            const ldo_cons_kl = parseNum(faRow[ldoCons]);
            const ldo_stock_kl = parseNum(faRow[ldoStock]);

            const hfo_receipt_kl = parseNum(faRow[hfoReceipt]);
            const hfo_cons_kl = parseNum(faRow[hfoCons]);
            const hfo_stock_kl = parseNum(faRow[hfoStock]);

            const coal_receipt_mt = parseNum(faRow[coalReceipt]);
            const coal_cons_mt = parseNum(faRow[coalCons]);
            const coal_stock_mt = parseNum(faRow[coalStock]);

            // Perf: GCV AR=1, GCV AF=5
            const coal_gcv_ar = parseNum(perfRow[1]);
            const coal_gcv_af = parseNum(perfRow[5]);

            // SAP: H2 Cons=14, CO2 Cons=15, N2 Cons=16
            const h2_cons = parseNum(sapRow[14]) / 7; // Convert bottles to Nos (Cylinders)
            const co2_cons = parseNum(sapRow[15]);
            const n2_cons = parseNum(sapRow[16]);

            // Fuel & Ash: H2 Stock (Filled + Empty)
            // H2 Filled=84, H2 Filled Empty=85, H2 Empty=88, H2 Empty Empty=89
            const h2_stock = parseNum(faRow[84]) + parseNum(faRow[85]);
            const co2_stock = parseNum(faRow[94]);
            const n2_stock = parseNum(faRow[103]);

            const h2_receipt = parseNum(faRow[86]); // Assuming Column 86 is receipt
            const co2_receipt = parseNum(faRow[93]);
            const n2_receipt = parseNum(faRow[102]);

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
           h2_cons, h2_stock, h2_receipt,
           co2_cons, co2_stock, co2_receipt,
           n2_cons, n2_stock, n2_receipt,
           status
         ) VALUES (
           $1, $2,
           $3, $4, $5, $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14,
           $15,
           $16, $17, $18,
           $19, $20, $21,
           $22, $23, $24,
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
           h2_stock = EXCLUDED.h2_stock,
           h2_receipt = EXCLUDED.h2_receipt,
           co2_cons = EXCLUDED.co2_cons,
           co2_stock = EXCLUDED.co2_stock,
           co2_receipt = EXCLUDED.co2_receipt,
           n2_cons = EXCLUDED.n2_cons,
           n2_stock = EXCLUDED.n2_stock,
           n2_receipt = EXCLUDED.n2_receipt,
           status = 'approved',
           updated_at = NOW()
       `;

            await pool.query(query, [
                plantId, entryDate,
                coal_receipt_mt, coal_cons_mt, coal_stock_mt, coal_gcv_ar, coal_gcv_af, scc_kg_kwh,
                ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
                hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl,
                soc_ml_kwh,
                h2_cons, h2_stock, h2_receipt,
                co2_cons, co2_stock, co2_receipt,
                n2_cons, n2_stock, n2_receipt
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
