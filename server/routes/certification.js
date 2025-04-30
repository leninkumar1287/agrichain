const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const contractABI = require('../../contracts/OrganicCertification.json').abi;
const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, contractABI, signer);
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const { CertificationRequest, Media, User, Checkpoint } = require('../../models/index');
const blockchainService = require('../../services/blockchain');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Function to convert UUID to integer
const uuidToInt = (uuid) => {
  // Remove hyphens and take first 8 characters
  const hex = uuid.replace(/-/g, '').substring(0, 8);
  // Convert to integer
  return parseInt(hex, 16);
};

// Function to convert integer to UUID
const intToUuid = (num) => {
  // Convert to hex and pad with zeros
  const hex = num.toString(16).padStart(8, '0');
  // Create a UUID-like string (not a real UUID, but matches our format)
  return `${hex}-0000-4000-8000-000000000000`;
};

// Create certification request (Farmer)
router.post('/requests', auth(['farmer']), upload.array('media', 10), async (req, res) => {
  try {
    console.log("Starting request creation process");
    const { productName, description, checkpoints } = req.body;
    const mediaFiles = req.files;
    const userId = req.user.id;

    console.log("Request data:", { productName, description, userId, filesCount: mediaFiles?.length });

    // Create certification request in database
    console.log("Creating request in database");
    const request = await CertificationRequest.create({
      productName,
      description,
      farmerId: userId,
      status: 'pending'
    });
    console.log("Database request created:", request.id);

    // Upload media files and create media records
    const mediaHashes = [];
    if (mediaFiles && mediaFiles.length > 0) {
      console.log("Processing media files");
      for (const file of mediaFiles) {
        const media = await Media.create({
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
          url: `/uploads/${file.filename}`,
          hash: file.filename,
          requestId: request.id
        });
        mediaHashes.push(media.hash);
      }
      console.log("Media files processed:", mediaHashes.length);
    }

    // Save checkpoints if provided
    if (checkpoints) {
      let parsedCheckpoints = checkpoints;
      if (typeof checkpoints === 'string') {
        parsedCheckpoints = JSON.parse(checkpoints);
      }
      console.log("Parsed checkpoints:", parsedCheckpoints);
      for (const cp of parsedCheckpoints) {
        const checkpointid = cp.id || cp.checkpointId;
        if (!checkpointid) {
          console.log("Skipping checkpoint with missing id:", cp);
          continue;
        }
        console.log("Saving checkpoint:", {
          requestid: request.id,
          checkpointid,
          answer: cp.answer,
          mediaurl: cp.mediaUrl || null
        });
        await Checkpoint.create({
          requestid: request.id,
          checkpointid,
          answer: cp.answer,
          mediaurl: cp.mediaUrl || null
        });
      }
      console.log("Checkpoints saved:", parsedCheckpoints.length);
    }

    // Create request on blockchain
    console.log("Creating request on blockchain");
    let blockchainResult;
    try {
      const blockchainRequestIdInt = uuidToInt(request.id);
      
      blockchainResult = await blockchainService.createCertificationRequest(
        productName,
        description,
        mediaHashes,
        blockchainRequestIdInt
      );
      console.log("Blockchain request created:", blockchainResult);

      const blockchainRequestId = intToUuid(blockchainResult.requestId);

      // Update request with blockchain data
      await request.update({
        blockchainRequestId,
        blockchainTransactions: {
          farmer: {
            initiated: blockchainResult.transactionHash,
            reverted: null
          },
          inspector: {
            in_progress: null,
            approved: null,
            rejected: null
          },
          certificate_issuer: {
            certified: null
          }
        }
      });
      console.log("Request updated with blockchain data:", {
        requestId: request.id,
        blockchainRequestId,
        transactionHash: blockchainResult.transactionHash
      });
    } catch (blockchainError) {
      console.error("Blockchain error:", blockchainError);
      await request.destroy();
      throw new Error(`Blockchain error: ${blockchainError.message}`);
    }

    res.status(201).json({
      request,
      blockchainResult
    });
  } catch (error) {
    console.error('Detailed error in request creation:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Error creating certification request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get farmer's requests
router.get('/requests', auth(['farmer']), async (req, res) => {
  try {
    const requests = await CertificationRequest.findAll({
      where: { farmerId: req.user.id },
      include: [
        { model: User, as: 'inspector' },
        { model: User, as: 'certifier' }
      ]
    });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// Get requests for inspection
router.get('/inspection/requests', auth(['inspector']), async (req, res) => {
  try {
    const requests = await CertificationRequest.findAll({
      where: { status: 'pending' },
      include: [
        { model: Media },
        { model: User, as: 'farmer' }
      ]
    });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching inspection requests:', error);
    res.status(500).json({ message: 'Error fetching inspection requests' });
  }
});

// Inspect request
router.post('/inspect/:requestId', auth(['inspector']), async (req, res) => {
  try {
    const { approved } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    const request = await CertificationRequest.findByPk(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending' && request.status !== 'in_progress') {
      return res.status(400).json({ message: 'Invalid request status for inspection' });
    }

    if (!request.blockchainRequestId) {
      return res.status(400).json({ message: 'Request not found on blockchain' });
    }

    // Convert blockchainRequestId to integer for smart contract
    const blockchainRequestIdInt = uuidToInt(request.blockchainRequestId);

    // Update blockchain
    const blockchainResult = await blockchainService.inspectRequest(
      blockchainRequestIdInt,
      approved
    );

    // Determine the new status and transaction type
    const newStatus = approved ? 'approved' : 'rejected';
    const transactionType = approved ? 'approved' : 'rejected';

    // Update database with new status and transaction hash
    const currentTransactions = request.blockchainTransactions || {};
    await request.update({
      status: newStatus,
      inspectorId: req.user.id,
      blockchainTransactions: {
        ...currentTransactions,
        inspector: {
          ...currentTransactions.inspector,
          [transactionType]: blockchainResult.transactionHash
        }
      }
    });

    res.json({ 
      message: `Request ${newStatus} successfully`,
      blockchainResult,
      token
    });
  } catch (error) {
    console.error('Error inspecting request:', error);
    res.status(500).json({ message: 'Error inspecting request', error: error.message });
  }
});

// Mark request as in progress
router.post('/inspect/:requestId/status', auth(['inspector']), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const request = await CertificationRequest.findByPk(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request cannot be marked as in progress' });
    }

    if (!request.blockchainRequestId) {
      return res.status(400).json({ message: 'Request not found on blockchain' });
    }

    // Convert blockchainRequestId to integer for smart contract
    const blockchainRequestIdInt = uuidToInt(request.blockchainRequestId);

    // Update blockchain
    const blockchainResult = await blockchainService.inspectRequest(
      blockchainRequestIdInt,
      false // in_progress is treated as not approved yet
    );

    // Update database
    const currentTransactions = request.blockchainTransactions || {};
    await request.update({
      status: 'in_progress',
      inspectorId: req.user.id,
      blockchainTransactions: {
        ...currentTransactions,
        inspector: {
          ...currentTransactions.inspector,
          in_progress: blockchainResult.transactionHash
        }
      }
    });

    res.json({ 
      message: 'Request marked as in progress successfully',
      blockchainResult,
      token
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ message: 'Error updating request status', error: error.message });
  }
});

// Issue certificate
router.post('/certify/:requestId', auth(['certificate_issuer']), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const request = await CertificationRequest.findByPk(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({ message: 'Request not approved' });
    }

    // Update blockchain
    const blockchainResult = await blockchainService.issueCertificate(
      parseInt(request.blockchainRequestId)
    );

    // Update database
    const currentTransactions = request.blockchainTransactions || {};
    await request.update({
      status: 'certified',
      certifierId: req.user.id,
      blockchainTransactions: {
        ...currentTransactions,
        certificate_issuer: {
          ...currentTransactions.certificate_issuer,
          certified: blockchainResult.transactionHash
        }
      }
    });

    res.json({ 
      message: 'Certificate issued successfully',
      blockchainResult,
      token
    });
  } catch (error) {
    console.error('Error issuing certificate:', error);
    res.status(500).json({ message: 'Error issuing certificate', error: error.message });
  }
});

// Revert request
router.post('/revert/:requestId', auth(['farmer']), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const request = await CertificationRequest.findByPk(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.farmerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (request.status === 'certified') {
      return res.status(400).json({ message: 'Cannot revert a certified request' });
    }

    // Update blockchain
    const blockchainResult = await blockchainService.revertRequest(
      parseInt(request.blockchainRequestId)
    );

    // Update database
    const currentTransactions = request.blockchainTransactions || {};
    await request.update({
      status: 'reverted',
      blockchainTransactions: {
        ...currentTransactions,
        farmer: {
          ...currentTransactions.farmer,
          reverted: blockchainResult.transactionHash
        }
      }
    });

    res.json({ 
      message: 'Request reverted successfully',
      blockchainResult,
      token
    });
  } catch (error) {
    console.error('Error reverting request:', error);
    res.status(500).json({ message: 'Error reverting request', error: error.message });
  }
});

// Get detailed request information
router.get('/requests/:requestId', auth(), async (req, res) => {
  try {
    const request = await CertificationRequest.findByPk(req.params.requestId, {
      include: [
        { model: Media },
        { model: User, as: 'farmer' },
        { model: User, as: 'inspector' },
        { model: User, as: 'certifier' }
      ]
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Get checkpoints separately
    const checkpoints = await Checkpoint.findAll({
      where: { requestid: request.id }
    });

    // Format the response
    const formattedRequest = {
      id: request.id,
      productName: request.productName,
      description: request.description,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      location: request.location,
      blockchainTransactionId: request.blockchainTransactionId,
      blockchainTransactionHash: request.blockchainTransactionHash,
      blockNumber: request.blockNumber,
      gasUsed: request.gasUsed,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      value: request.value,
      farmer: {
        id: request.farmer?.id,
        username: request.farmer?.username,
        email: request.farmer?.email
      },
      inspector: request.inspector ? {
        id: request.inspector.id,
        username: request.inspector.username,
        email: request.inspector.email
      } : null,
      certifier: request.certifier ? {
        id: request.certifier.id,
        username: request.certifier.username,
        email: request.certifier.email
      } : null,
      checkpoints: checkpoints.map(checkpoint => ({
        id: checkpoint.id,
        checkpointId: checkpoint.checkpointid,
        answer: checkpoint.answer,
        mediaUrl: checkpoint.mediaurl,
        createdAt: checkpoint.createdAt
      })) || [],
      media: request.Media?.map(media => ({
        id: media.id,
        type: media.type,
        url: media.url,
        hash: media.hash,
        createdAt: media.createdAt
      })) || []
    };

    res.json(formattedRequest);
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({ message: 'Error fetching request details', error: error.message });
  }
});

module.exports = router; 