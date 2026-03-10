const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('--- DB Check ---');
        const { rows: plants } = await pool.query('SELECT id, short_name, name FROM plants');
        plants.forEach(p => console.log(`Plant: ID=${p.id}, Short=${p.short_name}, Name=${p.name}`));

        const taqaId = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';
        const date = '2026-03-10';

        console.log(`Attempting dummy insert for plant ${taqaId}...`);
        try {
            await pool.query(
                'INSERT INTO taqa_daily_input (plant_id, entry_date, status) VALUES ($1, $2, $3) ON CONFLICT (plant_id, entry_date) DO UPDATE SET status = EXCLUDED.status',
                [taqaId, date, 'draft']
            );
            console.log('✅ Dummy insert/upsert successful.');
        } catch (err) {
            console.error('❌ Dummy insert failed:', err.message);
        }

        const { rows: taqaInput } = await pool.query('SELECT plant_id, entry_date, status FROM taqa_daily_input LIMIT 5');
        console.log(`Found ${taqaInput.length} TAQA rows.`);
        taqaInput.forEach(r => console.log(`  Row: plant=${r.plant_id}, date=${r.entry_date}, status=${r.status}`));

        process.exit(0);
    } catch (e) {
        console.error('Overall check failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
check();
