const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('--- Production Multi-Plant Setup ---');

        // 1. Ensure Plants exist
        console.log('Setting up plants...');
        const plants = [
            { id: '36cd41f9-b150-46da-a778-a838679a343f', short_name: 'TTPP', name: 'SEPC Power TTPP Stage I', capacity_mw: 525, plf_base_mw: 492.1875, fy_start_month: 4, location: 'Tuticorin', company_name: 'SEPC Power Pvt Ltd' },
            { id: '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b', short_name: 'TAQA', name: 'TAQA MEIL Neyveli', capacity_mw: 250, plf_base_mw: 250, fy_start_month: 4, location: 'Neyveli', company_name: 'MEIL Neyveli Energy Pvt Ltd' }
        ];

        for (const p of plants) {
            await pool.query(
                `INSERT INTO plants (id, short_name, name, capacity_mw, plf_base_mw, fy_start_month, location, company_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET 
                    short_name = EXCLUDED.short_name,
                    name = EXCLUDED.name, 
                    capacity_mw = EXCLUDED.capacity_mw,
                    plf_base_mw = EXCLUDED.plf_base_mw,
                    fy_start_month = EXCLUDED.fy_start_month`,
                [p.id, p.short_name, p.name, p.capacity_mw, p.plf_base_mw, p.fy_start_month, p.location, p.company_name]
            );
        }
        console.log('✅ Plants table updated.');

        // 2. Setup TAQA Table (if not exists)
        console.log('Checking TAQA Input table...');
        const migrationSql = fs.readFileSync(path.join(__dirname, 'migration_taqa_input_table.sql'), 'utf8');
        await pool.query(migrationSql);
        console.log('✅ TAQA Input table schema verified.');

        // 3. Setup TTPP Meters
        console.log('Restoring TTPP Meters...');
        const { rows: ttppRows } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const ttppId = ttppRows[0].id;

        const ttppMeters = [
            ['GEN_MAIN', 'GEN Meter - Main', 0.72, 'generation', 1],
            ['GEN_CHECK', 'GEN Meter - Check', 0.72, 'generation', 2],
            ['GT_IMP_MAIN', 'GT Main Import', 3.6, 'import', 3],
            ['GT_EXP_MAIN', 'GT Main Export', 3.6, 'export', 4],
            ['GT_IMP_CHK', 'GT Check Import', 3.6, 'import', 5],
            ['GT_EXP_CHK', 'GT Check Export', 3.6, 'export', 6],
            ['UT_A_IMP', 'UT A Main Import', 0.4, 'import', 7],
            ['UT_A_CHK', 'UT A Check Import', 0.4, 'import', 8],
            ['UT_B_IMP', 'UT B Main Import', 0.4, 'import', 9],
            ['UT_B_CHK', 'UT B Check Import', 0.4, 'import', 10],
            ['BR_IMP', 'BR Main Import', 1.8, 'import', 11],
            ['LINE1_EXP', 'Line 1 Main Export', 3.6, 'export', 12],
            ['LINE2_EXP', 'Line 2 Main Export', 3.6, 'export', 13]
        ];

        for (const [code, name, mult, type, ord] of ttppMeters) {
            await pool.query(
                `INSERT INTO meter_points (plant_id, meter_code, meter_name, multiplier, meter_type, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (plant_id, meter_code) DO NOTHING`,
                [ttppId, code, name, mult, type, ord]
            );
        }
        console.log('✅ TTPP Meters restored.');

        // 4. Setup TTPP Fuels
        console.log('Restoring TTPP Fuels...');
        const fuels = ['coal', 'ldo', 'hfo'];
        for (const fuel of fuels) {
            await pool.query(
                `INSERT INTO plant_fuels (plant_id, fuel_type, is_active)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT (plant_id, fuel_type) DO NOTHING`,
                [ttppId, fuel]
            );
        }
        console.log('✅ TTPP Fuels restored.');

        console.log('--- Setup Complete ---');
        process.exit(0);
    } catch (e) {
        console.error('❌ Setup failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
