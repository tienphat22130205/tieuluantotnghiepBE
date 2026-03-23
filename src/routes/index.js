const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const profileRoutes = require('../modules/user/profile.routes');

const router = express.Router();

// API routes
router.use('/api/auth', authRoutes);
router.use('/api/profile', profileRoutes);

// Health check
router.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

module.exports = router;
