const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  user: process.env.USER,
  host: 'localhost',
  database: 'postgres',
  password: '',
  port: 5432,
};

async function initDatabase() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log('Checking if database exists...');

    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'organic_certification'"
    );

    if (result.rows.length === 0) {
      console.log('Database does not exist. Creating new database...');
      await client.query('CREATE DATABASE organic_certification');
      console.log('✅ Database created successfully');
    } else {
      console.log('Database already exists, proceeding with schema check...');
    }
  } catch (err) {
    console.error('❌ Error during database check/creation:', err);
    throw err;
  } finally {
    await client.release();
    await pool.end();
  }

  // Connect to the organic_certification database
  const dbPool = new Pool({
    ...dbConfig,
    database: 'organic_certification'
  });

  const dbClient = await dbPool.connect();

  try {
    console.log('Creating UUID extension...');
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    console.log('Reading initialization SQL...');
    const sql = fs.readFileSync(path.join(__dirname, '../config/init.sql'), 'utf8');

    console.log('Executing schema creation...');
    await dbClient.query('BEGIN');

    try {
      await dbClient.query(sql);
      await dbClient.query('COMMIT');
      console.log('✅ Database schema created/updated successfully');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    }

    // Verify critical tables exist
    const tables = ['Users', 'CertificationRequests', 'Checkpoints', 'Media', 'Certificates'];
    for (const table of tables) {
      const result = await dbClient.query(
        `SELECT to_regclass('public."${table}"') IS NOT NULL as exists`
      );
      if (!result.rows[0].exists) {
        throw new Error(`Table "${table}" was not created properly`);
      }
    }

    console.log('✅ Schema verification complete');

  } catch (err) {
    console.error('❌ Error during schema creation:', err);
    throw err;
  } finally {
    await dbClient.release();
    await dbPool.end();
  }
}

// Execute initialization
console.log('Starting database initialization...');
initDatabase()
  .then(() => {
    console.log('✅ Database initialization completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  });
