const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {

    if (process.env.DATABASE_URL) {
      // Railway / production
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      });
    } else {
      // Local development
      pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'dgr_platform',
        user: process.env.DB_USER || 'dgr_user',
        password: process.env.DB_PASSWORD || '',
      });
    }

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }

  return pool;
}