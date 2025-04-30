-- Add new columns to CertificationRequests table
ALTER TABLE "CertificationRequests"
ADD COLUMN IF NOT EXISTS location JSONB,
ADD COLUMN IF NOT EXISTS "geoTag" JSONB,
ADD COLUMN IF NOT EXISTS "blockchainTransactionId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "dateAndTime" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add comments to explain the columns
COMMENT ON COLUMN "CertificationRequests".location IS 'Stores location data as JSONB (latitude, longitude, address)';
COMMENT ON COLUMN "CertificationRequests"."geoTag" IS 'Stores geotagging information as JSONB';
COMMENT ON COLUMN "CertificationRequests"."blockchainTransactionId" IS 'Stores the blockchain transaction ID';
COMMENT ON COLUMN "CertificationRequests"."dateAndTime" IS 'Timestamp of the certification request'; 