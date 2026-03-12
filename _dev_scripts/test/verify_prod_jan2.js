const { Client } = require('pg');

const prodConn = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';

async function verifyProdData() {
    const client = new Client({ connectionString: prodConn });
    await client.connect();

    console.log("----- PRODUCTION DATABASE DATA FOR TAQA (JAN 1 & 2) -----");
    const dates = ['2026-01-01', '2026-01-02'];

    for (const date of dates) {
        const res = await client.query('SELECT * FROM taqa_daily_input WHERE entry_date = $1', [date]);
        if (res.rows.length > 0) {
            const r = res.rows[0];
            console.log(`\n--- Date: ${date} ---`);
            console.log(`gen_main_meter: ${r.gen_main_meter}`);
            console.log(`net_export: ${r.net_export}`);
            console.log(`declared_capacity_mwhr: ${r.declared_capacity_mwhr}`);
            console.log(`schedule_gen_mldc: ${r.schedule_gen_mldc}`);
            console.log(`net_import_sy: ${r.net_import_sy}`);
            console.log(`Switchyard meters: peram_exp_main=${r.peram_exp_main}, deviak_exp_main=${r.deviak_exp_main}, cuddal_exp_main=${r.cuddal_exp_main}, nlc2_exp_main=${r.nlc2_exp_main}`);
        } else {
            console.log(`\nNo data found for ${date} in PRODUCTION`);
        }
    }

    await client.end();
}

verifyProdData().catch(console.error);
