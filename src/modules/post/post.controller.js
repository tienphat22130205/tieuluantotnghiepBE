const PostService = require('./post.service');
const { sendSuccess, sendError } = require('../../utils/response');

class PostController {
  static handleResult(res, result, errorMessage) {
    if (result.success) {
      return sendSuccess(res, result.statusCode, result.message, result.data);
    }

    return sendError(res, result.statusCode, result.message, result.error);
  }

  static async createMyImagePost(req, res) {
    try {
      const result = await PostService.createImagePost(req.user.id, req.body || {}, req.files || [], 'image');
      return PostController.handleResult(res, result, 'Create my image post controller error:');
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

  static async getPostById(req, res) {
    try {
      const result = await PostService.getPostById(req.user.id, req.params.postId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get post by id controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getComments(req, res) {
    try {
      const result = await PostService.getPostComments(req.user.id, req.params.postId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Get comments controller error:', error);
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

  // Get recent posts for moderation
  static async getRecentPostsForModeration(req, res) {
    try {
      const result = await PostService.getRecentPostsForModeration(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get recent posts for moderation controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Delete post by moderator
  static async deletePostByModerator(req, res) {
    try {
      const result = await PostService.deletePostByModerator(
        req.params.postId,
        req.user.id,
        req.body || {}
      );

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Delete post by moderator controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get all posts for management
  static async getAllPostsForManagement(req, res) {
    try {
      const result = await PostService.getAllPostsForManagement(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get all posts for management controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Delete comment by moderator
  static async deleteCommentByModerator(req, res) {
    try {
      const result = await PostService.deleteCommentByModerator(
        req.params.postId,
        req.params.commentId,
        req.user.id,
        req.body || {}
      );

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Delete comment by moderator controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get post overview
  static async getPostOverview(req, res) {
    try {
      const result = await PostService.getPostOverview(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get post overview controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get trending posts
  static async getTrendingPosts(req, res) {
    try {
      const result = await PostService.getTrendingPosts(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get trending posts controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get posts over time for line chart
  static async getPostsOverTime(req, res) {
    try {
      const result = await PostService.getPostsOverTime(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get posts over time controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get post types distribution for pie chart
  static async getPostTypesDistribution(req, res) {
    try {
      const result = await PostService.getPostTypesDistribution(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get post types distribution controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get top hashtags for bar chart
  static async getTopHashtags(req, res) {
    try {
      const result = await PostService.getTopHashtags(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get top hashtags controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  // Get engagement trend for line chart
  static async getEngagementTrend(req, res) {
    try {
      const result = await PostService.getEngagementTrend(req.query || {});

      if (result.success) {
        return sendSuccess(res, result.statusCode, result.message, result.data);
      }

      return sendError(res, result.statusCode, result.message, result.error);
    } catch (error) {
      console.error('Get engagement trend controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async searchPosts(req, res) {
    try {
      const result = await PostService.searchPosts(req.user.id, req.query || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }

      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      console.error('Search posts controller error:', error);
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = PostController;
