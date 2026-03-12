const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function run() {
  const email = 'admin@sepcpower.com';
  const password = 'Admin@1234';
  
  console.log(`Resetting password for ${email}...`);
  const hash = await bcrypt.hash(password, 12);
  
  const client = new Client({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
  });

  await client.connect();
  const res = await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
  console.log('Update result:', res.rowCount === 1 ? 'SUCCESS' : 'USER NOT FOUND');
  await client.end();
}

run().catch(console.error);
