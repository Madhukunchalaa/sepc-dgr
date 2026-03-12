const { Client } = require('pg');
async function run() {
    const c = new Client({
        connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
        ssl: { rejectUnauthorized: false }
    });
    await c.connect();
    const pidRes = await c.query("SELECT id FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1");
    const pid = pidRes.rows[0].id;

    // Fetch a week of data
    const res = await c.query("SELECT entry_date, gen_main_meter, gen_check_meter, net_export, schedule_gen_mldc FROM taqa_daily_input WHERE plant_id=$1 AND entry_date >= '2025-12-25' AND entry_date <= '2026-01-05' ORDER BY entry_date", [pid]);

    for (let i = 1; i < res.rows.length; i++) {
        const prev = res.rows[i - 1];
        const curr = res.rows[i];

        const deltaMWh = Number(curr.gen_main_meter) - Number(prev.gen_main_meter);

        // Let's test an MF of 2000
        const grossWithMf2000 = (deltaMWh * 2000) / 1000; // in MU

        // Print the comparison
        const dStr = new Date(curr.entry_date).toISOString().split('T')[0];
        console.log(`[${dStr}] Delta: ${deltaMWh.toFixed(3)} | Gross w/ MF2000: ${grossWithMf2000.toFixed(3)} MU | Net Export: ${(Number(curr.net_export) / 1000).toFixed(3)} MU | Schedule: ${(Number(curr.schedule_gen_mldc) / 1000).toFixed(3)} MU`);
    }

    c.end();
}
run();
