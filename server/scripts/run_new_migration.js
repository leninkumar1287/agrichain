const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.USER,
  host: 'localhost',
  database: 'organic_certification',
  password: '',
  port: 5432
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, 'add_new_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error); 