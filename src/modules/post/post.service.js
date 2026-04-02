const mongoose = require('mongoose');
const Post = require('./post.model');
const User = require('../auth/auth.model');
const { HTTP_STATUS, MESSAGES } = require('../../constants');

const ALLOWED_VISIBILITY = ['public', 'friends', 'private'];

const normalizeHashtags = (hashtags) => {
  if (!hashtags) {
    return [];
  }

  let list = hashtags;

  if (typeof hashtags === 'string') {
    try {
      const parsed = JSON.parse(hashtags);
      if (Array.isArray(parsed)) {
        list = parsed;
      } else {
        list = hashtags.split(',');
      }
    } catch (error) {
      list = hashtags.split(',');
    }
  }

  if (!Array.isArray(list)) {
    return [];
  }

  return [...new Set(list
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .map((item) => (item.startsWith('#') ? item : `#${item}`)))].slice(0, 20);
};

const toIdSet = (list = []) => new Set(list.map((id) => id.toString()));

const getFriendIdSet = (user) => {
  // Include both mutual followers (friends via follow) and explicit friends (via friend request)
  const followerIds = toIdSet(user?.followers || []);
  const mutualFollows = new Set((user?.following || [])
    .map((id) => id.toString())
    .filter((id) => followerIds.has(id)));
  
  const explicitFriends = toIdSet(user?.friends || []);
  
  // Combine both sets
  return new Set([...mutualFollows, ...explicitFriends]);
};

const canViewerAccessPost = (viewerId, post, friendIdSet) => {
  const postAuthorId = post.author.toString();

  if (postAuthorId === viewerId.toString()) {
    return true;
  }

  if (post.visibility === 'public') {
    return true;
  }

  if (post.visibility === 'friends') {
    return friendIdSet.has(postAuthorId);
  }

  return false;
};

class PostService {
  static async getViewerAndPostWithAccess(viewerId, postId) {
    if (!mongoose.Types.ObjectId.isValid(viewerId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID hoặc Post ID không hợp lệ',
      };
    }

    const [viewer, post] = await Promise.all([
      User.findById(viewerId).select('followers following friends'),
      Post.findById(postId),
    ]);

    if (!viewer) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: MESSAGES.USER_NOT_FOUND,
      };
    }

    if (!post) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy bài viết',
      };
    }

    const friendIdSet = getFriendIdSet(viewer);
    if (!canViewerAccessPost(viewerId, post, friendIdSet)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Bạn không có quyền truy cập bài viết này',
      };
    }

    return {
      success: true,
      viewer,
      post,
    };
  }

  static async createImagePost(userId, payload = {}, files = [], postType = 'image') {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const content = String(payload.content || '').trim();
      const visibility = String(payload.visibility || 'public').toLowerCase();
      const hashtags = normalizeHashtags(payload.hashtags);

      if (!ALLOWED_VISIBILITY.includes(visibility)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Chế độ hiển thị không hợp lệ. Chỉ chấp nhận: public, friends, private',
        };
      }

      const images = (files || []).map((file) => {
        const folder = file.filename.startsWith('avatar-') ? 'avatars' : 'posts';
        return `/uploads/${folder}/${file.filename}`;
      });

      if (images.length === 0) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Bài viết ảnh cần ít nhất 1 ảnh',
        };
      }

      const post = await Post.create({
        author: userId,
        content,
        hashtags,
        images,
        visibility,
        postType,
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Đăng bài ảnh thành công',
        data: post,
      };
    } catch (error) {
      console.error('Create image post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async getMyPosts(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const posts = await Post.find({ author: userId }).sort({ createdAt: -1 });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy danh sách bài viết thành công',
        data: posts,
      };
    } catch (error) {
      console.error('Get my posts error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async getFeedPosts(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const viewer = await User.findById(userId).select('followers following friends');
      if (!viewer) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      const friendIds = [...getFriendIdSet(viewer)].map((id) => new mongoose.Types.ObjectId(id));
      const viewerObjectId = new mongoose.Types.ObjectId(userId);

      const visibilityConditions = [
        { visibility: 'public' },
        { author: viewerObjectId },
      ];

      if (friendIds.length > 0) {
        visibilityConditions.push({ visibility: 'friends', author: { $in: friendIds } });
      }

      const posts = await Post.find({ $or: visibilityConditions })
        .populate('author', 'username firstName lastName avatar')
        .sort({ createdAt: -1 });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy bảng tin thành công',
        data: posts,
      };
    } catch (error) {
      console.error('Get feed posts error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async getUserPostsByViewer(viewerId, targetUserId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(viewerId) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const [viewer, targetUser] = await Promise.all([
        User.findById(viewerId).select('followers following friends'),
        User.findById(targetUserId).select('_id'),
      ]);

      if (!viewer || !targetUser) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      const isOwner = viewerId.toString() === targetUserId.toString();
      const friendIdSet = getFriendIdSet(viewer);
      const isFriend = friendIdSet.has(targetUserId.toString());

      let query = { author: targetUserId, visibility: 'public' };

      if (isOwner) {
        query = { author: targetUserId };
      } else if (isFriend) {
        query = {
          author: targetUserId,
          visibility: { $in: ['public', 'friends'] },
        };
      }

      const posts = await Post.find(query)
        .populate('author', 'username firstName lastName avatar')
        .sort({ createdAt: -1 });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy bài viết theo người dùng thành công',
        data: posts,
      };
    } catch (error) {
      console.error('Get user posts by viewer error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async createStatusPost(userId, payload = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const content = String(payload.content || '').trim();
      const visibility = String(payload.visibility || 'public').toLowerCase();
      const hashtags = normalizeHashtags(payload.hashtags);

      if (!content) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Bài viết trạng thái cần có nội dung',
        };
      }

      if (!ALLOWED_VISIBILITY.includes(visibility)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Chế độ hiển thị không hợp lệ. Chỉ chấp nhận: public, friends, private',
        };
      }

      const post = await Post.create({
        author: userId,
        content,
        hashtags,
        images: [],
        visibility,
        postType: 'status',
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Đăng trạng thái thành công',
        data: post,
      };
    } catch (error) {
      console.error('Create status post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async updateMyPost(userId, postId, payload = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(postId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID hoặc Post ID không hợp lệ',
        };
      }

      const post = await Post.findById(postId);
      if (!post) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy bài viết',
        };
      }

      if (post.author.toString() !== userId.toString()) {
        return {
          success: false,
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không có quyền chỉnh sửa bài viết này',
        };
      }

      const hasContent = Object.prototype.hasOwnProperty.call(payload, 'content');
      const hasVisibility = Object.prototype.hasOwnProperty.call(payload, 'visibility');

      if (!hasContent && !hasVisibility) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Vui lòng gửi ít nhất 1 trường cần cập nhật: content hoặc visibility',
        };
      }

      if (hasContent) {
        const content = String(payload.content || '').trim();
        if (post.postType === 'status' && !content) {
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Bài viết trạng thái cần có nội dung',
          };
        }
        post.content = content;
      }

      if (hasVisibility) {
        const visibility = String(payload.visibility || '').toLowerCase();
        if (!ALLOWED_VISIBILITY.includes(visibility)) {
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Chế độ hiển thị không hợp lệ. Chỉ chấp nhận: public, friends, private',
          };
        }
        post.visibility = visibility;
      }

      await post.save();

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Cập nhật bài viết thành công',
        data: post,
      };
    } catch (error) {
      console.error('Update my post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async deleteMyPost(userId, postId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(postId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID hoặc Post ID không hợp lệ',
        };
      }

      const post = await Post.findById(postId);
      if (!post) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy bài viết',
        };
      }

      if (post.author.toString() !== userId.toString()) {
        return {
          success: false,
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không có quyền xóa bài viết này',
        };
      }

      await Post.deleteOne({ _id: postId });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Xóa bài viết thành công',
        data: {
          deletedPostId: postId,
        },
      };
    } catch (error) {
      console.error('Delete my post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async likePost(userId, postId) {
    try {
      const accessResult = await this.getViewerAndPostWithAccess(userId, postId);
      if (!accessResult.success) {
        return accessResult;
      }

      const { post } = accessResult;
      const liked = post.likes.some((id) => id.toString() === userId.toString());
      if (!liked) {
        post.likes.push(userId);
        await post.save();
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: liked ? 'Bạn đã tym bài viết trước đó' : 'Tym bài viết thành công',
        data: {
          postId: post._id,
          likeCount: post.likes.length,
          liked: true,
        },
      };
    } catch (error) {
      console.error('Like post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async unlikePost(userId, postId) {
    try {
      const accessResult = await this.getViewerAndPostWithAccess(userId, postId);
      if (!accessResult.success) {
        return accessResult;
      }

      const { post } = accessResult;
      const previousCount = post.likes.length;
      post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
      const changed = post.likes.length !== previousCount;
      if (changed) {
        await post.save();
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: changed ? 'Bỏ tym bài viết thành công' : 'Bạn chưa tym bài viết này',
        data: {
          postId: post._id,
          likeCount: post.likes.length,
          liked: false,
        },
      };
    } catch (error) {
      console.error('Unlike post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async addComment(userId, postId, payload = {}) {
    try {
      const accessResult = await this.getViewerAndPostWithAccess(userId, postId);
      if (!accessResult.success) {
        return accessResult;
      }

      const content = String(payload.content || '').trim();
      if (!content) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Nội dung comment không được để trống',
        };
      }

      const { post } = accessResult;
      post.comments.push({
        user: userId,
        content,
      });
      await post.save();

      const newComment = post.comments[post.comments.length - 1];
      return {
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Comment bài viết thành công',
        data: {
          postId: post._id,
          comment: newComment,
          commentCount: post.comments.length,
        },
      };
    } catch (error) {
      console.error('Add comment error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async deleteComment(userId, postId, commentId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID, Post ID hoặc Comment ID không hợp lệ',
        };
      }

      const post = await Post.findById(postId);
      if (!post) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy bài viết',
        };
      }

      const comment = post.comments.id(commentId);
      if (!comment) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy comment',
        };
      }

      const isPostOwner = post.author.toString() === userId.toString();
      const isCommentOwner = comment.user.toString() === userId.toString();

      if (!isPostOwner && !isCommentOwner) {
        return {
          success: false,
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không có quyền xóa comment này',
        };
      }

      comment.deleteOne();
      await post.save();

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Xóa comment thành công',
        data: {
          postId: post._id,
          deletedCommentId: commentId,
          commentCount: post.comments.length,
        },
      };
    } catch (error) {
      console.error('Delete comment error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
}

module.exports = PostService;
