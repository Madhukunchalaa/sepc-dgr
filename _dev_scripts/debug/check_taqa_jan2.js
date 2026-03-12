const { Client } = require('pg');
async function run() {
    const c = new Client({
        connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
        ssl: { rejectUnauthorized: false }
    });
    await c.connect();
    const pidRes = await c.query("SELECT id FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1");
    const pid = pidRes.rows[0].id;
    const res = await c.query("SELECT entry_date, gen_main_meter, gen_check_meter, schedule_gen_mldc, deemed_gen_mwhr, net_export FROM taqa_daily_input WHERE plant_id=$1 AND entry_date IN ('2026-01-01', '2026-01-02') ORDER BY entry_date", [pid]);
    console.log(JSON.stringify(res.rows, null, 2));
    c.end();
}
run();
