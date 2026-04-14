const express = require('express');
const PostController = require('./post.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadPostImages } = require('../../middlewares/upload');

const router = express.Router();

router.post('/images', authenticate, uploadPostImages.array('images', 10), PostController.createMyImagePost);
router.post('/status', authenticate, PostController.createMyStatusPost);
router.get('/feed', authenticate, PostController.getFeedPosts);
router.get('/me', authenticate, PostController.getMyPosts);
router.get('/user/:userId', authenticate, PostController.getUserPosts);
router.patch('/:postId', authenticate, PostController.updateMyPost);
router.delete('/:postId', authenticate, PostController.deleteMyPost);
router.post('/:postId/like', authenticate, PostController.likePost);
router.delete('/:postId/like', authenticate, PostController.unlikePost);
router.post('/:postId/comments', authenticate, PostController.addComment);
router.delete('/:postId/comments/:commentId', authenticate, PostController.deleteComment);
router.post('/:postId/share', authenticate, PostController.sharePost);

module.exports = router;
