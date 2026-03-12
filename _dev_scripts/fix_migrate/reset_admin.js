const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

const hash = '$2b$12$BszlVGXnWKldAMBuO1dEPeQ/3wJpoL21dBDQkKtUGjM1OpnsRTsWq';
const email = 'admin@sepcpower.com';

pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email])
    .then(r => {
        console.log('Rows updated:', r.rowCount);
        return pool.query('SELECT email, password_hash, LENGTH(password_hash) as len FROM users WHERE email = $1', [email]);
    })
    .then(r => {
        console.log('Verification:', r.rows[0]);
    })
    .catch(console.error)
    .finally(() => pool.end());
