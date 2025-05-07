const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const db = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database configuration
const pool = new Pool({
  user: process.env.USER,
  host: 'localhost',
  database: 'organic_certification',
  password: '',
  port: 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  release();
});

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const certificationRoutes = require('./routes/certification');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/certification', certificationRoutes);

app.use('/uploads/checkpoint-media', express.static('uploads/checkpoint-media'));
app.use('/uploads/common-media', express.static('uploads/common-media'));

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  process.exit(1);
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  process.exit(1);
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log('Server Started', { 
    port: PORT, 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

const listEndpoints = require('express-list-endpoints');
console.table(listEndpoints(app));