const { Pool } = require('pg');

const pool = new Pool({
  // ... your config here ...
});

async function ensureColumns() {
  const client = await pool.connect();
  try {
    // Add blockchainRequestId if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='CertificationRequests' AND column_name='blockchainRequestId'
        ) THEN
          ALTER TABLE "CertificationRequests" ADD COLUMN "blockchainRequestId" VARCHAR(255);
        END IF;
      END$$;
    `);
    // Add blockchainTransactionHash if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='CertificationRequests' AND column_name='blockchainTransactionHash'
        ) THEN
          ALTER TABLE "CertificationRequests" ADD COLUMN "blockchainTransactionHash" VARCHAR(255);
        END IF;
      END$$;
    `);
    console.log('Columns ensured.');
  } catch (err) {
    console.error('Error ensuring columns:', err);
  } finally {
    client.release();
  }
}

// Call this at the start of your app
ensureColumns();

// ... rest of your db logic ... 