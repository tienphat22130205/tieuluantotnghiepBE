const express = require('express');
const AIController = require('./ai.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadPostImagesMemory } = require('../../middlewares/upload');

const router = express.Router();

router.post(
  '/generate-content-upload',
  authenticate,
  uploadPostImagesMemory.array('images', 10),
  AIController.generatePostContentUpload
);

module.exports = router;
