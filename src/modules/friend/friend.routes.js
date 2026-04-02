const express = require('express');
const friendController = require('./friend.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Friend Requests
router.post('/requests', friendController.sendFriendRequest);
router.get('/requests', friendController.getPendingRequests);
router.get('/requests/sent', friendController.getSentFriendRequests);
router.patch('/requests/:requestId', friendController.respondFriendRequest);
router.delete('/requests/:requestId', friendController.cancelFriendRequest);

// Friends List
router.get('/', friendController.getFriends);
router.delete('/:userId', friendController.unfriendUser);

// Follow/Unfollow
router.post('/follow/:userId', friendController.followUser);
router.delete('/follow/:userId', friendController.unfollowUser);

// Followers/Following
router.get('/followers/me', friendController.getFollowers);
router.get('/followers/:userId', friendController.getFollowersOfUser);
router.get('/following/me', friendController.getFollowing);
router.get('/following/:userId', friendController.getFollowingOfUser);

// Friend Status
router.get('/status/:userId', friendController.getFriendStatus);

// Keep generic dynamic route last to avoid capturing specific paths above
router.get('/:userId', friendController.getFriendsOfUser);

module.exports = router;
