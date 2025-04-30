const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const auth = require('../middleware/auth');
const { userValidationRules, validate } = require('../middleware/validation');
const { body } = require('express-validator');

// Register new user
router.post('/register', userValidationRules, validate, async (req, res) => {
  try {
    const { user, token } = await authService.register(req.body);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);
    res.json({ user, token });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

// Get current user
router.get('/me', auth(), async (req, res) => {
  try {
    const user = await authService.verifyToken(req.headers.authorization.split(' ')[1]);
    res.json(user);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

// Update user
router.put('/me', auth(), [
  body('username').optional().isLength({ min: 3 }),
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 6 }),
  validate
], async (req, res) => {
  try {
    const user = await authService.updateUser(req.user.id, req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 