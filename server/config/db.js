const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.USER, // This will use your system username
  host: 'localhost',
  database: 'organic_certification',
  password: '', // No password for local development
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Add logging to query method
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const start = Date.now();
  try {
    const result = await originalQuery(...args);
    const duration = Date.now() - start;
    
    return result;
  } catch (error) {
    throw error;
  }
};

// Test the connection
const testConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
  } catch (err) {
    process.exit(1);
  } finally {
    client.release();
  }
};

testConnection();

module.exports = pool; 