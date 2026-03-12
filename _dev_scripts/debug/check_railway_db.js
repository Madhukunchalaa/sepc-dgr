const { Client } = require('pg');

const RAILWAY_DB_URL = process.argv[2];
const DATE_TO_CHECK = process.argv[3] || '2026-01-10';

if (!RAILWAY_DB_URL) {
    console.error('\n❌ Please provide the Railway PostgreSQL URL as the first argument.');
    console.log('Usage: node check_railway_db.js "postgresql://user:password@containers-us-west-...railway.app:5432/railway" "2026-01-10"\n');
    process.exit(1);
}

async function checkDb() {
    const client = new Client({
        connectionString: RAILWAY_DB_URL,
        ssl: { rejectUnauthorized: false } // Required for most managed DBs including Railway
    });

    try {
        await client.connect();
        console.log(`✅ Connected to Railway Database!`);

        // 1. Get TAQA Plant ID
        const plantRes = await client.query(`SELECT id, name FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1`);
        if (plantRes.rows.length === 0) {
            console.log('❌ Could not find a plant starting with "TAQA" in the Railway database.');
            return;
        }
        const plantId = plantRes.rows[0].id;
        console.log(`\n🏭 Found TAQA Plant: ${plantRes.rows[0].name} (ID: ${plantId})`);

        // 2. Fetch TAQA data for the specified date
        console.log(`\n📅 Checking TAQA data for date: ${DATE_TO_CHECK}...`);
        const dataRes = await client.query(
            `SELECT * FROM taqa_daily_input WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, DATE_TO_CHECK]
        );

        if (dataRes.rows.length === 0) {
            console.log(`\n⚠️ No data found in 'taqa_daily_input' for ${DATE_TO_CHECK}.`);
            console.log(`This means either the data hasn't been saved yet, or it was saved under a different date.`);
        } else {
            const row = dataRes.rows[0];

            // Count filled vs empty fields
            let filledCount = 0;
            let nullCount = 0;
            const emptyFields = [];

            for (const [key, value] of Object.entries(row)) {
                if (value !== null && value !== '') {
                    filledCount++;
                } else {
                    nullCount++;
                    emptyFields.push(key);
                }
            }

            console.log(`\n✅ Found data for ${DATE_TO_CHECK} (Row ID: ${row.id})`);
            console.log(`📝 Submission Status: ${row.status || 'DRAFT'}`);
            console.log(`-------------------------------------------------`);
            console.log(`📊 Statistics:`);
            console.log(`   - Total Database Columns: ${Object.keys(row).length}`);
            console.log(`   - Populated Fields: ${filledCount}`);
            console.log(`   - Empty/Null Fields: ${nullCount}`);

            console.log(`\n🔍 Key Fields Sample:`);
            console.log(`   - gen_main_meter: ${row.gen_main_meter}`);
            console.log(`   - total_hours: ${row.total_hours}`);
            console.log(`   - lignite_receipt_taqa_wb: ${row.lignite_receipt_taqa_wb}`);
            console.log(`   - chem_gcv_nlcil: ${row.chem_gcv_nlcil}`);
            console.log(`   - date_created: ${row.created_at}`);

            // Uncomment to print the full data payload
            // console.log('\n📦 Full Data Dump:');
            // console.dir(row, { depth: null, colors: true });
        }

        // Check if dates exist at all for TAQA
        console.log(`\n🔍 Quick check of last 5 available dates for TAQA:`);
        const datesRes = await client.query(
            `SELECT entry_date, status FROM taqa_daily_input WHERE plant_id = $1 ORDER BY entry_date DESC LIMIT 5`,
            [plantId]
        );
        if (datesRes.rows.length > 0) {
            datesRes.rows.forEach(r => {
                // format date neatly
                const d = new Date(r.entry_date).toISOString().split('T')[0];
                console.log(`   - Date: ${d} (Status: ${r.status})`);
            });
        } else {
            console.log(`   - No dates found in the database.`)
        }

    } catch (err) {
        console.error('\n❌ Database Connection or Query Error:', err.message);
    } finally {
        await client.end();
    }
}

checkDb();
