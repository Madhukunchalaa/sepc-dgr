const { Client } = require('pg');

const remoteConfig = {
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
};

async function checkSchema() {
    const c = new Client(remoteConfig);
    try {
        await c.connect();
        const res = await c.query(`
            SELECT column_name, data_type, numeric_precision, numeric_scale 
            FROM information_schema.columns 
            WHERE table_name = 'taqa_daily_input' 
              AND data_type = 'numeric'
        `);
        console.log("TAQA Numeric Schema:");
        res.rows.forEach(r => console.log(`${r.column_name}: precision=${r.numeric_precision}, scale=${r.numeric_scale}`));
    } catch (e) {
        console.error(e);
    } finally {
        await c.end();
    }
}
checkSchema();
