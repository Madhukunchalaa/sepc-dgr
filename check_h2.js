const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://dgr_user:1234@localhost:5432/dgr_platform'
});

async function check() {
    await client.connect();
    const res = await client.query("SELECT * FROM daily_fuel WHERE entry_date = '2026-02-05'");
    console.log('Daily Data:', JSON.stringify(res.rows, null, 2));

    const mtdRes = await client.query(`
    SELECT SUM(h2_cons) as mtd_sum FROM daily_fuel 
    WHERE plant_id = $1 
    AND DATE_TRUNC('month', entry_date) = '2026-02-01'
    AND entry_date <= '2026-02-05'
    AND status IN ('submitted','approved','locked')
  `, [res.rows[0]?.plant_id]);
    console.log('MTD Data:', JSON.stringify(mtdRes.rows, null, 2));

    const mapRes = await client.query("SELECT * FROM scada_mappings WHERE plant_id = $1", [res.rows[0]?.plant_id]);
    console.log('SCADA Mappings:', JSON.stringify(mapRes.rows, null, 2));

    await client.end();
}

check().catch(console.error);
