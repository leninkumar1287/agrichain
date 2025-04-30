'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First, try to drop the old blockchainTransactionHash column if it exists
      await queryInterface.sequelize.query(`
        DO $$ 
        BEGIN 
          IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'CertificationRequests' 
            AND column_name = 'blockchainTransactionHash'
          ) THEN
            ALTER TABLE "CertificationRequests" 
            DROP COLUMN "blockchainTransactionHash";
          END IF;
        END $$;
      `);

      // Update or add the blockchainTransactions column
      await queryInterface.sequelize.query(`
        DO $$ 
        BEGIN 
          IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'CertificationRequests' 
            AND column_name = 'blockchainTransactions'
          ) THEN
            -- Update existing column's default value
            ALTER TABLE "CertificationRequests" 
            ALTER COLUMN "blockchainTransactions" SET DEFAULT '{
              "farmer": {
                "initiated": null,
                "reverted": null
              },
              "inspector": {
                "in_progress": null,
                "approved": null,
                "rejected": null
              },
              "certificate_issuer": {
                "certified": null
              }
            }'::jsonb;

            -- Update existing null values with the default structure
            UPDATE "CertificationRequests"
            SET "blockchainTransactions" = '{
              "farmer": {
                "initiated": null,
                "reverted": null
              },
              "inspector": {
                "in_progress": null,
                "approved": null,
                "rejected": null
              },
              "certificate_issuer": {
                "certified": null
              }
            }'::jsonb
            WHERE "blockchainTransactions" IS NULL;
          ELSE
            -- Add new column if it doesn't exist
            ALTER TABLE "CertificationRequests"
            ADD COLUMN "blockchainTransactions" JSONB DEFAULT '{
              "farmer": {
                "initiated": null,
                "reverted": null
              },
              "inspector": {
                "in_progress": null,
                "approved": null,
                "rejected": null
              },
              "certificate_issuer": {
                "certified": null
              }
            }'::jsonb;
          END IF;
        END $$;
      `);

      // Update the status column to use the new enum values
      await queryInterface.sequelize.query(`
        DO $$ 
        BEGIN 
          -- Drop the existing check constraint if it exists
          ALTER TABLE "CertificationRequests" 
          DROP CONSTRAINT IF EXISTS "status_check";

          -- Update the status column type and add new check constraint
          ALTER TABLE "CertificationRequests" 
          ALTER COLUMN "status" TYPE VARCHAR(255);
          
          ALTER TABLE "CertificationRequests" 
          ADD CONSTRAINT "status_check" 
          CHECK ("status" IN ('pending', 'in_progress', 'approved', 'rejected', 'certified'));
        END $$;
      `);
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove the blockchainTransactions column
      await queryInterface.sequelize.query(`
        ALTER TABLE "CertificationRequests" 
        DROP COLUMN IF EXISTS "blockchainTransactions";
      `);

      // Add back the old blockchainTransactionHash column
      await queryInterface.addColumn('CertificationRequests', 'blockchainTransactionHash', {
        type: Sequelize.STRING,
        allowNull: true
      });

      // Revert the status column to its original state
      await queryInterface.sequelize.query(`
        ALTER TABLE "CertificationRequests" 
        DROP CONSTRAINT IF EXISTS "status_check";
        
        ALTER TABLE "CertificationRequests" 
        ALTER COLUMN "status" TYPE VARCHAR(255);
      `);
    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 