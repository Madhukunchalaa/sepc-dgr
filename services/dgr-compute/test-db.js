const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@postgres-ess5.railway.internal:5432/railway' });

client.connect().then(async () => {
    try {
        const { rows } = await client.query(`
      SELECT *, 
        CASE 
          WHEN EXTRACT(MONTH FROM NOW()) >= fy_start_month 
          THEN EXTRACT(YEAR FROM NOW())::TEXT || '-' || (EXTRACT(YEAR FROM NOW())+1)::TEXT
          ELSE (EXTRACT(YEAR FROM NOW())-1)::TEXT || '-' || EXTRACT(YEAR FROM NOW())::TEXT
        END AS fy_label
      FROM plants WHERE id = 1
    `);
        console.log('Plant 1:', rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.end();
    }
});
