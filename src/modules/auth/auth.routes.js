const express = require('express');
const AuthController = require('./auth.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const { ROLES } = require('../../constants');

const router = express.Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/verify-email', AuthController.verifyEmail);

// Protected routes
router.get('/me', authenticate, AuthController.getCurrentUser);
router.post('/logout', authenticate, AuthController.logout);
router.post('/suggest-username', authenticate, AuthController.suggestUsername);
router.post('/set-username', authenticate, AuthController.setUsername);
router.get('/moderator/dashboard', authenticate, authorize(ROLES.MODERATOR), AuthController.getModeratorDashboard);
router.get('/admin/dashboard', authenticate, authorize(ROLES.ADMIN), AuthController.getAdminDashboard);
router.get('/admin/users', authenticate, authorize(ROLES.ADMIN), AuthController.getAdminUserList);
router.patch('/users/:userId/role', authenticate, authorize(ROLES.ADMIN), AuthController.updateUserRole);
router.patch('/users/:userId/ban', authenticate, authorize(ROLES.ADMIN), AuthController.banUser);
router.patch('/users/:userId/unban', authenticate, authorize(ROLES.ADMIN), AuthController.unbanUser);

module.exports = router;
