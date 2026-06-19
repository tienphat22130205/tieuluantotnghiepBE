const express = require('express');
const StoryController = require('./story.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadStoryMedia } = require('../../middlewares/upload');

const router = express.Router();

router.post('/', authenticate, uploadStoryMedia.single('file'), StoryController.createStory);
router.get('/', authenticate, StoryController.getFeedStories);
router.get('/archive', authenticate, StoryController.getArchivedStories);
router.post('/:storyId/view', authenticate, StoryController.markStoryViewed);
router.delete('/:storyId', authenticate, StoryController.deleteStory);

module.exports = router;
