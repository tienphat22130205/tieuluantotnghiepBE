const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');

const router = express.Router();

// API routes
router.use('/api/auth', authRoutes);

// Health check
router.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

module.exports = router;
