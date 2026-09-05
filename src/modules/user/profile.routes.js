const express = require('express');
const ProfileController = require('./profile.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadAvatar } = require('../../middlewares/upload');

const router = express.Router();

router.get('/me', authenticate, ProfileController.getMyProfile);
router.put('/me', authenticate, ProfileController.updateMyProfile);
router.patch('/me/avatar', authenticate, uploadAvatar.single('avatar'), ProfileController.updateMyAvatar);
router.delete('/me/avatar', authenticate, ProfileController.removeMyAvatar);
router.get('/:userId', authenticate, ProfileController.getProfileById);

module.exports = router;
