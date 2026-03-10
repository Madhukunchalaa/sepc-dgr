const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function restore() {
    try {
        console.log('Restoring TTPP meter points...');
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        if (plants.length === 0) {
            console.error('TTPP plant not found!');
            return;
        }
        const plantId = plants[0].id;

        const meters = [
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

        for (const [code, name, mult, type, ord] of meters) {
            await pool.query(
                `INSERT INTO meter_points (plant_id, meter_code, meter_name, multiplier, meter_type, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (plant_id, meter_code) DO NOTHING`,
                [plantId, code, name, mult, type, ord]
            );
        }
        console.log('✅ TTPP meters restored successfully.');

        console.log('Restoring TTPP fuels...');
        const fuels = ['coal', 'ldo', 'hfo'];
        for (const fuel of fuels) {
            await pool.query(
                `INSERT INTO plant_fuels (plant_id, fuel_type, is_active)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT (plant_id, fuel_type) DO NOTHING`,
                [plantId, fuel]
            );
        }
        console.log('✅ TTPP fuels restored successfully.');

    } catch (e) {
        console.error('❌ Restore failed:', e.message);
    } finally {
        await pool.end();
    }
}
restore();
