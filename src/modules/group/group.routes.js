const express = require('express');
const GroupController = require('./group.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadPostImages } = require('../../middlewares/upload');

const router = express.Router();

// Tất cả routes đều yêu cầu xác thực
router.use(authenticate);

// ── Group CRUD ──
router.post('/', uploadPostImages.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'avatar', maxCount: 1 }]), GroupController.createGroup);
router.get('/search', GroupController.searchGroups);
router.get('/my', GroupController.getMyGroups);
router.get('/:groupId', GroupController.getGroupById);
router.patch('/:groupId', uploadPostImages.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'avatar', maxCount: 1 }]), GroupController.updateGroup);
router.delete('/:groupId', GroupController.deleteGroup);

// ── Membership ──
router.post('/:groupId/join', GroupController.joinGroup);
router.delete('/:groupId/leave', GroupController.leaveGroup);
router.get('/:groupId/members', GroupController.getMembers);
router.get('/:groupId/members/pending', GroupController.getPendingMembers);
router.patch('/:groupId/members/:userId/approve', GroupController.approveMember);
router.patch('/:groupId/members/:userId/reject', GroupController.rejectMember);
router.patch('/:groupId/members/:userId/ban', GroupController.banMember);
router.patch('/:groupId/members/:userId/promote', GroupController.promoteMember);
router.patch('/:groupId/members/:userId/demote', GroupController.demoteMember);

// ── Group Posts ──
router.post('/:groupId/posts', uploadPostImages.fields([{ name: 'images', maxCount: 10 }]), GroupController.createGroupPost);
router.get('/:groupId/posts', GroupController.getGroupPosts);
router.delete('/:groupId/posts/:postId', GroupController.deleteGroupPost);
router.patch('/:groupId/posts/:postId/pin', GroupController.pinGroupPost);
router.post('/:groupId/posts/:postId/like', GroupController.likeGroupPost);
router.delete('/:groupId/posts/:postId/like', GroupController.unlikeGroupPost);
router.post('/:groupId/posts/:postId/comments', GroupController.addGroupComment);
router.delete('/:groupId/posts/:postId/comments/:commentId', GroupController.deleteGroupComment);

// ── Group Chat ──
router.get('/:groupId/messages', GroupController.getGroupMessages);
router.post('/:groupId/messages', GroupController.sendGroupMessage);

// ── Polls ──
router.post('/:groupId/polls', GroupController.createPoll);
router.get('/:groupId/polls', GroupController.getGroupPolls);
router.post('/:groupId/polls/:pollId/vote', GroupController.votePoll);
router.patch('/:groupId/polls/:pollId/close', GroupController.closePoll);

// ── Events ──
router.post('/:groupId/events', uploadPostImages.fields([{ name: 'coverImage', maxCount: 1 }]), GroupController.createEvent);
router.get('/:groupId/events', GroupController.getGroupEvents);
router.patch('/:groupId/events/:eventId/attend', GroupController.respondToEvent);

module.exports = router;
