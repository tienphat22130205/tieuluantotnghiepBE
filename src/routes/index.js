const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const profileRoutes = require('../modules/user/profile.routes');
const userRoutes = require('../modules/user/user.routes');
const postRoutes = require('../modules/post/post.routes');
const aiRoutes = require('../modules/ai/ai.routes');
const friendRoutes = require('../modules/friend/friend.routes');
const notificationRoutes = require('../modules/notification/notification.routes');

const router = express.Router();

// API routes
router.use('/api/auth', authRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/users', userRoutes);
router.use('/api/posts', postRoutes);
router.use('/api/ai', aiRoutes);
router.use('/api/friends', friendRoutes);
router.use('/api/notifications', notificationRoutes);

// Health check
router.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

module.exports = router;
