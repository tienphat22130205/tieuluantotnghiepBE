const PostService = require('./post.service');
const { sendSuccess, sendError } = require('../../utils/response');

class PostController {
  static async createMyImagePost(req, res) {
    try {
      const result = await PostService.createImagePost(req.user.id, req.body || {}, req.files || [], 'image');
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Create my image post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getMyPosts(req, res) {
    try {
      const result = await PostService.getMyPosts(req.user.id);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get my posts controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async createMyStatusPost(req, res) {
    try {
      const result = await PostService.createStatusPost(req.user.id, req.body || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Create my status post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getFeedPosts(req, res) {
    try {
      const result = await PostService.getFeedPosts(req.user.id);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get feed posts controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getUserPosts(req, res) {
    try {
      const result = await PostService.getUserPostsByViewer(req.user.id, req.params.userId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get user posts controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async updateMyPost(req, res) {
    try {
      const result = await PostService.updateMyPost(req.user.id, req.params.postId, req.body || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Update my post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async deleteMyPost(req, res) {
    try {
      const result = await PostService.deleteMyPost(req.user.id, req.params.postId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Delete my post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = PostController;
