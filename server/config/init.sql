-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS "Users" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    "walletAddress" VARCHAR(255),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create certification_requests table
CREATE TABLE IF NOT EXISTS "CertificationRequests" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "farmerId" UUID REFERENCES "Users"(id),
    "productName" VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    "inspectorId" UUID REFERENCES "Users"(id),
    "certifierId" UUID REFERENCES "Users"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create media_files table
CREATE TABLE IF NOT EXISTS "MediaFiles" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "requestId" UUID REFERENCES "CertificationRequests"(id),
    "filePath" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create certificates table
CREATE TABLE IF NOT EXISTS "Certificates" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "requestId" UUID REFERENCES "CertificationRequests"(id),
    "certifierId" UUID REFERENCES "Users"(id),
    "issueDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
); 