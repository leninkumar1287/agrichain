const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const auth = require('../middleware/auth');
const mediaService = require('../services/mediaService');
const { mediaValidationRules, validate } = require('../middleware/validation');
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

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload media
router.post('/upload', 
  auth(), 
  upload.single('file'),
  mediaValidationRules,
  validate,
  async (req, res) => {
    try {
      const media = await mediaService.uploadMedia(req.file, req.body.requestId);
      res.status(201).json(media);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Get media by request
router.get('/request/:requestId', auth(), async (req, res) => {
  try {
    const media = await mediaService.getMediaByRequest(req.params.requestId);
    res.json(media);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete media
router.delete('/:mediaId', auth(), async (req, res) => {
  try {
    const result = await mediaService.deleteMedia(req.params.mediaId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update media
router.put('/:mediaId', 
  auth(),
  [
    body('type').optional().isIn(['image', 'video']),
    body('url').optional().isURL(),
    validate
  ],
  async (req, res) => {
    try {
      const media = await mediaService.updateMedia(req.params.mediaId, req.body);
      res.json(media);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

module.exports = router; 