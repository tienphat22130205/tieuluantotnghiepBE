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

  static async likePost(req, res) {
    try {
      const result = await PostService.likePost(req.user.id, req.params.postId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Like post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async unlikePost(req, res) {
    try {
      const result = await PostService.unlikePost(req.user.id, req.params.postId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Unlike post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async addComment(req, res) {
    try {
      const result = await PostService.addComment(req.user.id, req.params.postId, req.body || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Add comment controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async deleteComment(req, res) {
    try {
      const result = await PostService.deleteComment(req.user.id, req.params.postId, req.params.commentId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Delete comment controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async sharePost(req, res) {
    try {
      const result = await PostService.sharePost(req.user.id, req.params.postId, req.body || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Share post controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = PostController;
