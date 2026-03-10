const { Client, Pool } = require('pg');

const localConfig = {
    host: 'localhost',
    port: 5432,
    database: 'dgr_platform',
    user: 'dgr_user',
    password: '1234'
};

const remoteConfig = {
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
};

async function sync() {
    console.log("🚀 Starting Safe Local -> Production Data Sync for TAQA...");

    const local = new Client(localConfig);
    const remote = new Pool(remoteConfig);

    try {
        await local.connect();
        await remote.connect();

        // 1. Get TAQA IDs
        const resLocal = await local.query(`SELECT id FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1`);
        const resRemote = await remote.query(`SELECT id FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1`);

        if (!resLocal.rows[0] || !resRemote.rows[0]) {
            throw new Error("TAQA plant not found in one of the databases");
        }

        const localId = resLocal.rows[0].id;
        const remoteId = resRemote.rows[0].id;

        // 2. Fetch schema boundaries
        const schemaRes = await remote.query(`
            SELECT column_name, numeric_precision, numeric_scale 
            FROM information_schema.columns 
            WHERE table_name = 'taqa_daily_input' AND data_type = 'numeric'
        `);
        const limits = {};
        for (let r of schemaRes.rows) {
            limits[r.column_name] = {
                p: parseInt(r.numeric_precision),
                s: parseInt(r.numeric_scale || 0)
            };
        }

        // 3. Fetch populated local data
        const localData = await local.query(
            `SELECT * FROM taqa_daily_input WHERE plant_id = $1 AND gen_main_meter IS NOT NULL`,
            [localId]
        );

        console.log(`Found ${localData.rows.length} populated TAQA records locally.`);

        // 4. Upsert to Remote
        let successCount = 0;
        for (const row of localData.rows) {
            const entryDate = row.entry_date;
            const dataToInsert = { ...row, plant_id: remoteId };
            delete dataToInsert.id;
            delete dataToInsert.created_at;
            delete dataToInsert.updated_at;

            // Constrain values to schema limits
            for (const key in dataToInsert) {
                if (limits[key] && dataToInsert[key] !== null && dataToInsert[key] !== '') {
                    let val = Number(dataToInsert[key]);
                    if (isNaN(val)) {
                        dataToInsert[key] = null;
                        continue;
                    }

                    const p = limits[key].p;
                    const s = limits[key].s;
                    const maxIntegerDigits = p - s;

                    const maxAllowedVal = Math.pow(10, maxIntegerDigits) - Math.pow(10, -s);
                    const minAllowedVal = -maxAllowedVal;

                    if (val > maxAllowedVal) val = maxAllowedVal;
                    if (val < minAllowedVal) val = minAllowedVal;

                    dataToInsert[key] = val.toFixed(s);
                }
            }

            const columns = Object.keys(dataToInsert);
            const values = Object.values(dataToInsert);

            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');

            const query = `
                INSERT INTO taqa_daily_input (${columns.join(', ')})
                VALUES (${placeholders})
                ON CONFLICT (plant_id, entry_date) DO UPDATE SET
                ${setClause}, updated_at = NOW()
            `;

            try {
                await remote.query(query, values);
                successCount++;
                console.log(`✅ Synced data for date: ${new Date(entryDate).toISOString().split('T')[0]}`);
            } catch (err) {
                console.error(`❌ Failed to sync date: ${new Date(entryDate).toISOString().split('T')[0]} - ${err.message}`);
            }
        }

        console.log(`🎉 Sync Complete! Successfully synced ${successCount} records to production.`);

    } catch (e) {
        console.error("Migration Error:", e);
    } finally {
        await local.end();
        await remote.end();
    }
}

sync();
