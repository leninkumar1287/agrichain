-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS "Users" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'inspector', 'certificate_issuer')),
    "walletAddress" VARCHAR(255),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create certification_requests table
CREATE TABLE IF NOT EXISTS "CertificationRequests" (
    "requestId" SERIAL PRIMARY KEY,
    "farmerId" UUID REFERENCES "Users"(id),
    "productName" VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'approved', 'rejected', 'certified', 'reverted')
    ),
    "inspectorId" UUID REFERENCES "Users"(id),
    "certifierId" UUID REFERENCES "Users"(id),
    -- Blockchain related fields
    "blockchainRequestId" TEXT,
    "blockchainTransactions" JSONB DEFAULT '{
        "farmer": {
            "initiated": null,
            "reverted": null,
            "initiatedAt": null,
            "revertedAt": null
        },
        "inspector": {
            "in_progress": null,
            "approved": null,
            "rejected": null,
            "inProgressAt": null,
            "approvedAt": null,
            "rejectedAt": null
        },
        "certificate_issuer": {
            "certified": null,
            "certifiedAt": null
        }
    }'::jsonb,
    location JSONB,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Checkpoints table
CREATE TABLE IF NOT EXISTS "Checkpoints" (
    id SERIAL PRIMARY KEY,
    "requestId" INTEGER NOT NULL REFERENCES "CertificationRequests"("requestId") ON DELETE CASCADE,
    "checkpointId" INTEGER NOT NULL,
    answer VARCHAR(255) NOT NULL,
    "mediaUrl" VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Media table (replacing MediaFiles)
CREATE TABLE IF NOT EXISTS "Media" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'video')),
    url VARCHAR(255) NOT NULL,
    hash VARCHAR(255) NOT NULL,
    "requestId" INTEGER NOT NULL REFERENCES "CertificationRequests"("requestId") ON DELETE CASCADE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create certificates table
CREATE TABLE IF NOT EXISTS "Certificates" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "requestId" INTEGER REFERENCES "CertificationRequests"("requestId"),
    "certifierId" UUID REFERENCES "Users"(id),
    "issueDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    "blockchainTransactionId" TEXT,
    "blockchainTransactionHash" TEXT,
    "transactionTimestamp" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table
CREATE TABLE IF NOT EXISTS "DhiwayCertificates" (
  "requestId" INTEGER PRIMARY KEY REFERENCES "CertificationRequests"("requestId"),
  "dhiwayResponse" JSONB NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_certification_requests_farmer" ON "CertificationRequests"("farmerId");
CREATE INDEX IF NOT EXISTS "idx_certification_requests_inspector" ON "CertificationRequests"("inspectorId");
CREATE INDEX IF NOT EXISTS "idx_certification_requests_certifier" ON "CertificationRequests"("certifierId");
CREATE INDEX IF NOT EXISTS "idx_certification_requests_status" ON "CertificationRequests"(status);
CREATE INDEX IF NOT EXISTS "idx_certification_requests_blockchain_id" ON "CertificationRequests"("blockchainRequestId");
CREATE INDEX IF NOT EXISTS "idx_checkpoints_request" ON "Checkpoints"("requestId");
CREATE INDEX IF NOT EXISTS "idx_media_request" ON "Media"("requestId");
CREATE INDEX IF NOT EXISTS "idx_certificates_request" ON "Certificates"("requestId");
CREATE INDEX IF NOT EXISTS "idxDhiwayCertificatesRequest" ON "DhiwayCertificates"("requestId");

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update timestamps
CREATE TRIGGER update_user_modtime
    BEFORE UPDATE ON "Users"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certification_request_modtime
    BEFORE UPDATE ON "CertificationRequests"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checkpoint_modtime
    BEFORE UPDATE ON "Checkpoints"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_modtime
    BEFORE UPDATE ON "Media"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificate_modtime
    BEFORE UPDATE ON "Certificates"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add missing columns to DhiwayCertificates table