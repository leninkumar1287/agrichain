const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.USER,
  host: 'localhost',
  database: 'postgres',
  password: '',
  port: 5432,
});

async function resetDatabase() {
  const client = await pool.connect();
  try {
    // Drop the database if it exists
    await client.query('DROP DATABASE IF EXISTS organic_certification');
    console.log('Database dropped successfully');
    
    // Create a new database
    await client.query('CREATE DATABASE organic_certification');
    console.log('Database created successfully');
  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  } finally {
    client.release();
  }

  // Connect to the new database
  const dbPool = new Pool({
    user: process.env.USER,
    host: 'localhost',
    database: 'organic_certification',
    password: '',
    port: 5432,
  });

  const dbClient = await dbPool.connect();
  try {
    // Enable UUID extension
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('UUID extension enabled');

    // Read and execute the SQL file
    const sql = fs.readFileSync(path.join(__dirname, '../config/init.sql'), 'utf8');
    await dbClient.query(sql);
    console.log('Database schema created successfully');
  } catch (err) {
    console.error('Error creating schema:', err);
    process.exit(1);
  } finally {
    dbClient.release();
    dbPool.end();
  }
}

resetDatabase().then(() => {
  console.log('Database reset complete');
  process.exit(0);
}).catch(err => {
  console.error('Database reset failed:', err);
  process.exit(1);
}); 