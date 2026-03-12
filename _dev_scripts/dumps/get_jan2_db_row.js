const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query('SELECT * FROM taqa_daily_input WHERE entry_date = $1', ['2026-01-02']);
    if (res.rows[0]) {
        fs.writeFileSync('jan2_db_row.json', JSON.stringify(res.rows[0], null, 2));
        console.log("Saved Jan 2nd DB data to jan2_db_row.json");
    } else {
        console.log("No data found for 2026-01-02");
    }

    await client.end();
}

run().catch(console.error);
