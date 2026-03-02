require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');

process.env.DB_PASSWORD = '1234';

const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

// We are targeting TTPP
const PLANT_ID = '9ba1ba8d-19cd-4934-8b01-fc7b960c18dd';

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}

async function run() {
    console.log('Connecting to database...');

    try {
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = plants[0].id;
        console.log(`Using Plant ID: ${plantId}`);

        console.log('Loading Excel workbook (this may take a moment)...');
        const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');
        const wsWater = wb.Sheets['Water'];
        const dataWater = XLSX.utils.sheet_to_json(wsWater, { header: 1 });

        // In Water sheet:
        // Row 2 is typically units/metadata, Row 3 is Headers. Data starts roughly Row 5.

        // Column mapping from Water sheet (Row 2 headers):
        // Col 0: DATE
        // Col 1: DM Water Generation
        // Col 4: Total DM Water Consumption (DM Plant Data)
        // Col 7: DM Water Total Stock (CST + DMST)
        // Col 8: DM Water Consumption (Cycle Makeup)
        // Col 20: Service Water Cons.
        // Col 56: Potable Water Consumption
        // Col 66: Sea Water Consumption

        let rowsProcessed = 0;
        let rowsInserted = 0;

        for (let r = 5; r < dataWater.length; r++) {
            const row = dataWater[r];
            if (!row || !row[0]) continue;

            const dateVal = row[0];
            let dateStr;

            if (typeof dateVal === 'number') {
                // Excel serial date format
                const parsed = XLSX.SSF.parse_date_code(dateVal);
                // Build YYYY-MM-DD
                dateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
            } else if (typeof dateVal === 'string' && dateVal.includes('-')) {
                dateStr = new Date(dateVal).toISOString().split('T')[0];
            } else {
                continue; // Could be a summary/footer row
            }

            // Past Feb 5th, stop
            if (new Date(dateStr) > new Date('2026-02-05')) break;

            // Extract raw info using correct column indices
            const dmGen = parseNum(row[1]);
            const dmTotalCons = parseNum(row[4]);
            const dmStock = parseNum(row[7]);
            const dmCycleMakeup = parseNum(row[8]);
            const serviceWaterCons = parseNum(row[20]);
            const potableWaterCons = parseNum(row[56]);
            const seaWaterCons = parseNum(row[66]);

            // Calculate pct in DB using Generation MU from daily_power
            // For mass import, we'll let a CTE query fetch it on the fly.

            const upsertQuery = `
          WITH power_data AS (
             SELECT generation_mu FROM daily_power 
             WHERE plant_id = $1 AND entry_date = $2
          )
          INSERT INTO daily_water (
             plant_id, entry_date,
             dm_generation_m3, dm_cycle_makeup_m3, dm_cycle_pct, dm_total_cons_m3, dm_stock_m3,
             service_water_m3, potable_water_m3, sea_water_m3,
             status, updated_at
          )
          VALUES (
             $1, $2,
             $3, $4, 
             -- pct math
             CASE 
               WHEN (SELECT generation_mu FROM power_data) > 0 
               THEN ($4 * 100.0) / ((SELECT generation_mu FROM power_data) * 1000.0)
               ELSE NULL
             END,
             $5, $6, $7, $8, $9,
             'approved', NOW()
          )
          ON CONFLICT (plant_id, entry_date) DO UPDATE SET
             dm_generation_m3 = EXCLUDED.dm_generation_m3,
             dm_cycle_makeup_m3 = EXCLUDED.dm_cycle_makeup_m3,
             dm_cycle_pct = EXCLUDED.dm_cycle_pct,
             dm_total_cons_m3 = EXCLUDED.dm_total_cons_m3,
             dm_stock_m3 = EXCLUDED.dm_stock_m3,
             service_water_m3 = EXCLUDED.service_water_m3,
             potable_water_m3 = EXCLUDED.potable_water_m3,
             sea_water_m3 = EXCLUDED.sea_water_m3,
             status = 'approved',
             updated_at = NOW();
      `;

            await pool.query(upsertQuery, [
                plantId, dateStr,
                dmGen, dmCycleMakeup, dmTotalCons, dmStock, serviceWaterCons, potableWaterCons, seaWaterCons
            ]);

            rowsProcessed++;
            rowsInserted++;
        }

        console.log(`\n✅ Water seeding complete! processed ${rowsProcessed} rows, successfully upserted ${rowsInserted} historical dates.`);

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        pool.end();
    }
}

run();
