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

module.exports = router;
