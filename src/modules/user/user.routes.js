const express = require('express');
const UserController = require('./user.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.get('/search', authenticate, UserController.searchUsers);
router.get('/presence', authenticate, UserController.getUsersPresence);
router.get('/presence/:userId', authenticate, UserController.getUserPresence);

module.exports = router;
