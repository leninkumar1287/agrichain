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

async function resetDatabase() {
  console.log('Starting database reset process...');

  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    // Force disconnect all users
    console.log('Disconnecting all users from the database...');
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'organic_certification'
      AND pid <> pg_backend_pid();
    `);

    // Drop and recreate database
    console.log('Dropping existing database...');
    await client.query('DROP DATABASE IF EXISTS organic_certification');

    console.log('Creating new database...');
    await client.query('CREATE DATABASE organic_certification');
    console.log('✅ Database recreated successfully');

  } catch (err) {
    console.error('❌ Error during database reset:', err);
    throw err;
  } finally {
    await client.release();
    await pool.end();
  }

  // Connect to the new database
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

    console.log('Creating new schema...');
    await dbClient.query('BEGIN');

    try {
      console.log("sql :",sql)
      await dbClient.query(sql);
      await dbClient.query('COMMIT');
      console.log('✅ Database schema created successfully');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    }

    // Verify schema creation
    console.log('Verifying schema creation...');
    const tables = ['Users', 'CertificationRequests', 'Checkpoints', 'Media', 'Certificates'];
    for (const table of tables) {
      const result = await dbClient.query(
        `SELECT to_regclass('public."${table}"') IS NOT NULL as exists`
      );
      if (!result.rows[0].exists) {
        throw new Error(`Table "${table}" was not created properly`);
      }
    }

    // Verify indexes
    console.log('Verifying indexes...');
    const indexCheck = await dbClient.query(`
      SELECT COUNT(*) as index_count 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);

    if (indexCheck.rows[0].index_count < 8) { // We expect at least 8 indexes
      console.warn('⚠️ Warning: Some indexes might be missing');
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

// Execute reset
console.log('Starting database reset...');
resetDatabase()
  .then(() => {
    console.log('✅ Database reset completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database reset failed:', err);
    process.exit(1);
  });
