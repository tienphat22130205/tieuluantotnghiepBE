const StoryService = require('./story.service');
const { sendSuccess, sendError } = require('../../utils/response');

class StoryController {
  static handleResult(res, result) {
    if (result.success) {
      return sendSuccess(res, result.statusCode, result.message, result.data);
    }
    return sendError(res, result.statusCode, result.message, result.error);
  }

  static async createStory(req, res) {
    try {
      const result = await StoryService.createStory(req.user.id, req.body || {}, req.file);
      return StoryController.handleResult(res, result);
    } catch (error) {
      console.error('Create story controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getFeedStories(req, res) {
    try {
      const result = await StoryService.getActiveStories(req.user.id);
      return StoryController.handleResult(res, result);
    } catch (error) {
      console.error('Get feed stories controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getArchivedStories(req, res) {
    try {
      const result = await StoryService.getArchivedStories(req.user.id);
      return StoryController.handleResult(res, result);
    } catch (error) {
      console.error('Get archived stories controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async markStoryViewed(req, res) {
    try {
      const result = await StoryService.markAsViewed(req.user.id, req.params.storyId);
      return StoryController.handleResult(res, result);
    } catch (error) {
      console.error('Mark story viewed controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async reactToStory(req, res) {
    try {
      const result = await StoryService.addReaction(req.user.id, req.params.storyId, req.body.reaction);
      return StoryController.handleResult(res, result);
    } catch (error) {
      console.error('React to story controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async deleteStory(req, res) {
    try {
      const result = await StoryService.deleteStory(req.user.id, req.params.storyId);
      return StoryController.handleResult(res, result);
    } catch (error) {
      console.error('Delete story controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = StoryController;
