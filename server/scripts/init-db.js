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

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'organic_certification'"
    );
    
    if (result.rows.length === 0) {
      await client.query('CREATE DATABASE organic_certification');
      console.log('Database created successfully');
    } else {
      console.log('Database already exists');
    }
  } catch (err) {
    console.error('Error checking/creating database:', err);
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

initDatabase().then(() => {
  console.log('Database initialization complete');
  process.exit(0);
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
}); 