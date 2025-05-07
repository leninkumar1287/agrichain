const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware.js');

// Register new user
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, email, password, role, mobile } = req.body;

    // Validate input
    if (!username || !email || !password || !role || !mobile) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate role
    const validRoles = ['farmer', 'inspector', 'certificate_issuer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Check if user already exists
    const userExists = await client.query(
      'SELECT * FROM "Users" WHERE username = $1 OR email = $2 OR mobile = $3',
      [username, email, mobile]
    );

    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'User already exists',
        details: userExists.rows[0].username === username
          ? 'Username already taken'
          : userExists.rows[0].email === email
          ? 'Email already registered'
          : 'Mobile number already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const newUser = await client.query(
      'INSERT INTO "Users" (username, email, password, role, mobile) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role',
      [username, email, hashedPassword, role, mobile]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.rows[0].id, role: newUser.rows[0].role },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        role: newUser.rows[0].role
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// Login user
router.post('/login', async (req, res) => {
  const client = await pool.connect();
  try {
    // Accept credentials from req.body.email
    const credentials = req.body.email;

    // Validate input
    if (!credentials || !credentials.identifier || !credentials.password) {
      return res.status(400).json({ message: 'Email or mobile number and password are required' });
    }

    // Check if identifier is an email or mobile number
    const isEmail = credentials.identifier.includes('@');
    const userQuery = isEmail
      ? 'SELECT * FROM "Users" WHERE email = $1'
      : 'SELECT * FROM "Users" WHERE mobile = $1';

    const user = await client.query(userQuery, [credentials.identifier]);

    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(credentials.password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        role: user.rows[0].role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query('SELECT id, username, email, role FROM "Users" WHERE id = $1', [userId]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
});

// Update user profile (except username)
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, name } = req.body;
    // Only allow updating email and name
    const { rowCount } = await pool.query(
      'UPDATE "Users" SET email = $1, name = $2 WHERE id = $3',
      [email, name, userId]
    );
    if (!rowCount) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});

// Delete user profile
router.delete('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Optionally, delete related data (requests, etc.) here
    await pool.query('DELETE FROM "Users" WHERE id = $1', [userId]);
    res.json({ message: 'Profile deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting profile', error: err.message });
  }
});

module.exports = router; 