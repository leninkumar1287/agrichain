-- Add location column to CertificationRequests table
ALTER TABLE "CertificationRequests"
ADD COLUMN location JSONB;
 
-- Add comment to explain the column
COMMENT ON COLUMN "CertificationRequests".location IS 'Stores location data as JSONB for flexibility (latitude, longitude, address, etc.)'; 