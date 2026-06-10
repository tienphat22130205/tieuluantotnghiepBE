const express = require('express');
const PostController = require('./post.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const { uploadPostImages } = require('../../middlewares/upload');
const { ROLES } = require('../../constants');

const router = express.Router();

router.post('/images', authenticate, uploadPostImages.array('images', 10), PostController.createMyImagePost);
router.post('/status', authenticate, PostController.createMyStatusPost);
router.get('/feed', authenticate, PostController.getFeedPosts);
router.get('/me', authenticate, PostController.getMyPosts);
router.get('/user/:userId', authenticate, PostController.getUserPosts);
router.get('/:postId', authenticate, PostController.getPostById);
router.patch('/:postId', authenticate, PostController.updateMyPost);
router.delete('/:postId', authenticate, PostController.deleteMyPost);
router.post('/:postId/like', authenticate, PostController.likePost);
router.delete('/:postId/like', authenticate, PostController.unlikePost);
router.get('/:postId/comments', authenticate, PostController.getComments);
router.post('/:postId/comments', authenticate, PostController.addComment);
// Moderator routes for content moderation (specific routes before generic ones)
router.delete('/:postId/comments/:commentId/moderator', authenticate, authorize(ROLES.MODERATOR, ROLES.ADMIN), PostController.deleteCommentByModerator);
router.delete('/:postId/comments/:commentId', authenticate, PostController.deleteComment);
router.post('/:postId/share', authenticate, PostController.sharePost);

// More moderator routes
router.get('/moderation/recent', authenticate, authorize(ROLES.MODERATOR, ROLES.ADMIN), PostController.getRecentPostsForModeration);
router.delete('/:postId/moderator', authenticate, authorize(ROLES.MODERATOR, ROLES.ADMIN), PostController.deletePostByModerator);

// Admin routes for post management and statistics
router.get('/management/all', authenticate, authorize(ROLES.ADMIN), PostController.getAllPostsForManagement);
router.get('/stats/overview', authenticate, authorize(ROLES.ADMIN), PostController.getPostOverview);
router.get('/stats/trending', authenticate, PostController.getTrendingPosts);
router.get('/stats/posts-over-time', authenticate, authorize(ROLES.ADMIN), PostController.getPostsOverTime);

module.exports = router;
