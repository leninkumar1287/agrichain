const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const auth = require('../middleware/auth');
const certificationService = require('../services/certificationService');
const mediaService = require('../services/mediaService');
const { certificationValidationRules, validate } = require('../middleware/validation');
const { body } = require('express-validator');

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

// Create certification request (Farmer)
router.post('/request', 
  auth(['farmer']), 
  upload.array('media', 10),
  certificationValidationRules,
  validate,
  async (req, res) => {
    try {
      const result = await certificationService.createRequest(req.body, req.user.id, req.files);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Get farmer's requests
router.get('/farmer/requests', auth(['farmer']), async (req, res) => {
  try {
    const requests = await certificationService.getFarmerRequests(req.user.id);
    res.json(requests);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get requests for inspection
router.get('/inspection/requests', auth(['inspector']), async (req, res) => {
  try {
    const requests = await certificationService.getInspectionRequests();
    res.json(requests);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Inspect request
router.post('/inspect/:requestId', 
  auth(['inspector']),
  [
    body('approved').isBoolean().withMessage('Approved must be a boolean value'),
    validate
  ],
  async (req, res) => {
    try {
      const request = await certificationService.inspectRequest(
        req.params.
        req.body.approved,
        req.user.id
      );
      res.json(request);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Issue certificate
router.post('/certify/:requestId', auth(['certificate_issuer']), async (req, res) => {
  try {
    const request = await certificationService.issueCertificate(
      req.params.
      req.user.id
    );
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Revert request
router.post('/revert/:requestId', auth(['farmer']), async (req, res) => {
  try {
    const result = await certificationService.revertRequest(
      req.params.
      req.user.id
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get detailed request information
router.get('/:requestId', auth(), async (req, res) => {
  try {
    const request = await certificationService.getRequestDetails(req.params.requestId);
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 