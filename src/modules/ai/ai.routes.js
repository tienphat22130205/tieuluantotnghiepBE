const express = require('express');
const AIController = require('./ai.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadPostImagesMemory } = require('../../middlewares/upload');

const router = express.Router();

router.get('/detect-location', authenticate, AIController.detectLocation);

router.post(
  '/generate-content-upload',
  authenticate,
  uploadPostImagesMemory.array('images', 10),
  AIController.generatePostContentUpload
);

router.post(
  '/moderate',
  authenticate,
  uploadPostImagesMemory.array('images', 10),
  AIController.moderateContent
);

module.exports = router;
