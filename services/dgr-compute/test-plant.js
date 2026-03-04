const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@postgres-ess5.railway.internal:5432/railway' });

client.connect().then(async () => {
    try {
        const { rows } = await client.query('SELECT id FROM plants LIMIT 1');
        console.log('Result:', rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.end();
    }
});
