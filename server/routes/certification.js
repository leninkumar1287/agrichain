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
require('dotenv').config();
const { DhiwayCertificate } = require('../../models');
const axios = require('axios')
const { uploadCheckpoint, uploadCommon } = require('../../middleware/fileUploader');


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
  // const hex = uuid.replace(/-/g, '').substring(0, 8);
  // Convert to integer
  return uuid;
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
    const { productName, description, checkpoints } = req.body;
    const requestId = Math.floor(100000 + Math.random() * 900000);
    const mediaFiles = req.files;
    const userId = req.user.id;
    // Create certification request in database
    const request = await CertificationRequest.create({
      requestId,
      productName,
      description,
      farmerId: userId,
      status: 'pending'
    });
    // Upload media files and create media records
    const mediaHashes = [];
    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        const media = await Media.create({
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
          url: `/uploads/${file.filename}`,
          hash: file.filename,
          requestId: request.requestId
        });
        mediaHashes.push(media.hash);
      }
    }

    // Save checkpoints if provided
    if (checkpoints) {
      let parsedCheckpoints = checkpoints;
      if (typeof checkpoints === 'string') {
        parsedCheckpoints = JSON.parse(checkpoints);
      }
      for (const cp of parsedCheckpoints) {
        const checkpointId = cp.id || cp.checkpointId;
        if (!checkpointId) {
          continue;
        }
        await Checkpoint.create({
          requestId: request.requestId,
          checkpointId,
          answer: cp.answer,
          mediaUrl: cp.mediaUrl || null
        });
      }
    }

    // Create request on blockchain
    let blockchainResult;
    try {
      blockchainResult = await blockchainService.createCertificationRequest(
        requestId,
        productName,
        description,
        mediaHashes,
      );
      // Update request with blockchain data
      await request.update({
        blockchainRequestId: requestId,
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

    } catch (blockchainError) {
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
      // where: { status: 'pending' },
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
    const blockchainResult = await blockchainService.approveRequest(
      blockchainRequestIdInt
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
          in_progress: transactionType === 'approved' ? blockchainResult.transactionHash : null,
          approved: transactionType === 'approved' ? blockchainResult.transactionHash : null,
          rejected: transactionType === 'rejected' ? blockchainResult.transactionHash : null
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
// router.post('/inspect/:requestId/status', auth(['inspector']), async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(' ')[1];
//     const request = await CertificationRequest.findByPk(req.params.requestId);

//     if (!request) {
//       return res.status(404).json({ message: 'Request not found' });
//     }

//     if (request.status !== 'pending') {
//       return res.status(400).json({ message: 'Request cannot be marked as in progress' });
//     }

//     if (!request.blockchainRequestId) {
//       return res.status(400).json({ message: 'Request not found on blockchain' });
//     }

//     // Convert blockchainRequestId to integer for smart contract
//     const blockchainRequestIdInt = uuidToInt(request.blockchainRequestId);

//     // Update blockchain
//     const blockchainResult = await blockchainService.inspectRequest(
//       blockchainRequestIdInt,
//       false // in_progress is treated as not approved yet
//     );

//     // Update database
//     const currentTransactions = request.blockchainTransactions || {};
//     await request.update({
//       status: 'in_progress',
//       inspectorId: req.user.id,
//       blockchainTransactions: {
//         ...currentTransactions,
//         inspector: {
//           ...currentTransactions.inspector,
//           in_progress: blockchainResult.transactionHash
//         }
//       }
//     });

//     res.json({ 
//       message: 'Request marked as in progress successfully',
//       blockchainResult,
//       token
//     });
//   } catch (error) {
//     console.error('Error updating request status:', error);
//     res.status(500).json({ message: 'Error updating request status', error: error.message });
//   }
// });

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
    const blockchainResult = await blockchainService.markInProgress(blockchainRequestIdInt);
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

// Issue certificate'

router.get('/issuer/requests', auth(['certificate_issuer']), async (req, res) => {
  try {
    const requests = await CertificationRequest.findAll({

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


router.post('/certify/:requestId', auth(['certificate_issuer']), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const request = await CertificationRequest.findByPk(req.params.requestId, {
      include: [
        { model: User, as: 'farmer' },
        { model: User, as: 'inspector' }
      ]
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({ message: 'Request not approved' });
    }

    // 1. Prepare Cord API payload
    const cordPayload = {
      schemaId: process.env.CORD_SCHEMA_ID,
      active: true,
      publish: true,
      send_email: true,
      issuer_message: "Certificate issued via platform",
      need_cc: false,
      need_admin_cc: false,
      name: request.farmer?.username,
      farmer_id: request.farmerId,
      id: request.requestId,
      approver: request.inspectorId,
      issuer: req.user.id
    };

    // 2. Call Cord API
    const cordResponse = await axios.post(
      `https://api.studio.dhiway.com/api/v1/${process.env.CORD_ORG_ID}/${process.env.CORD_SPACE_ID}/records`,
      cordPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.CORD_API_TOKEN}`,
          "X-UserId": process.env.CORD_USER_ID,
          "Content-Type": "application/json"
        }
      }
    );

    // 3. Save Cord response in DhiwayCertificates table
    const certData = cordResponse.data;
    await DhiwayCertificate.create({
      requestId: req.params.requestId,
      dhiwayResponse: certData
    });


    // 4. Proceed with blockchain call as before
    const blockchainResult = await blockchainService.issueCertificate(
      parseInt(request.blockchainRequestId)
    );

    // 5. Update database
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
      cordCertificate: certData,
      token
    });
  } catch (error) {
    console.error('Error issuing certificate:', error);
    res.status(500).json({ message: 'Error issuing certificate', error: error.message });
  }
});

router.get('/dhiway-certificate/:requestId', auth(['farmer','certificate_issuer']), async (req, res) => {
  try {
    const cert = await DhiwayCertificate.findOne({ where: { requestId: req.params.requestId } });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    res.json(cert);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching certificate', error: error.message });
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
router.get('/requests/:requestId', auth(['farmer','inspector','certificate_issuer']), async (req, res) => {
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
      where: { requestId: request.requestId }
    });

    // Format the response
    const formattedRequest = {
      id: request.requestId,
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
        checkpointId: checkpoint.checkpointId,
        answer: checkpoint.answer,
        mediaUrl: checkpoint.mediaUrl,
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

// Checkpoint media upload
router.post('/upload/checkpoint', uploadCheckpoint.single('file'), async (req, res) => {
  try {
    const { checkpointId } = req.body;
    if (!checkpointId) return res.status(400).json({ message: 'checkpointId is required' });

    // Update Checkpoint table
    await Checkpoint.update(
      { mediaUrl: `/uploads/checkpoint-media/${req.file.filename}` },
      { where: { id: checkpointId } }
    );

    res.status(201).json({ url: `/uploads/checkpoint-media/${req.file.filename}` });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading checkpoint media', error: error.message });
  }
});

// Common media upload
router.post('/upload/common', uploadCommon.single('file'), async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ message: 'requestId is required' });

    // Save to Media table
    const media = await Media.create({
      type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
      url: `/uploads/common-media/${req.file.filename}`,
      hash: req.file.filename,
      requestId
    });

    res.status(201).json({ url: media.url, mediaId: media.id });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading common media', error: error.message });
  }
});

router.post('/delete-media', async (req, res) => {
  try {
    const { mediaUrl, checkpointId } = req.body;
    if (!mediaUrl) return res.status(400).json({ message: 'mediaUrl is required' });

    // Remove leading slash if present
    const relativePath = mediaUrl.startsWith('/') ? mediaUrl.slice(1) : mediaUrl;
    // __dirname is e.g. /Users/you/project/server/routes
    // Go up to project root, then to uploads/checkpoint-media/...
    const filePath = path.join(__dirname, '..', '..', relativePath);

    // Debug: log the file path
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      // Optionally update DB here
      if (checkpointId) {
        await Checkpoint.update({ mediaUrl: null }, { where: { id: checkpointId } });
      }
      res.json({ message: 'Media deleted' });
    } else {
      res.status(404).json({ message: 'File not found on server', filePath });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Error deleting media', error: error.message });
  }
});

module.exports = router; 