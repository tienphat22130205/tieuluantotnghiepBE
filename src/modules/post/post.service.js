const mongoose = require('mongoose');
const Post = require('./post.model');
const User = require('../auth/auth.model');
const NotificationService = require('../notification/notification.service');
const { emitToPostRoom, emitToUser, emitStatsUpdate } = require('../../realtime/socket');
const { HTTP_STATUS, MESSAGES } = require('../../constants');
const { saveFile } = require('../../utils/cloudinary');

const ALLOWED_VISIBILITY = ['public', 'friends', 'private'];

const SHARED_POST_POPULATE = {
  path: 'sharedPost',
  match: {
    isDeleted: { $ne: true },
  },
  populate: {
    path: 'author',
    select: 'username firstName lastName avatar',
  },
};

const COMMENT_USER_POPULATE = {
  path: 'comments.user',
  select: 'username firstName lastName avatar',
};

const ACTIVE_POST_FILTER = {
  isDeleted: { $ne: true },
};

const TIME_RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const getDateFilter = (timeRange) => {
  const days = TIME_RANGE_DAYS[String(timeRange || '').toLowerCase()];
  if (!days) return {};
  return { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
};

const getMatchStage = (timeRange) => {
  const matchStage = { ...ACTIVE_POST_FILTER };
  const dateFilter = getDateFilter(timeRange);
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }
  return matchStage;
};

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

const normalizeLocation = (locationInput) => {
  const DEFAULT_LOCATION = {
    lat: null,
    lng: null,
    placeName: '',
    city: '',
    region: '',
    country: '',
    source: 'unknown',
    isApproximate: false,
  };

  if (locationInput === undefined) {
    return {
      hasLocationField: false,
      location: DEFAULT_LOCATION,
      error: null,
    };
  }

  if (locationInput === null || locationInput === '') {
    return {
      hasLocationField: true,
      location: DEFAULT_LOCATION,
      error: null,
    };
  }

  let raw = locationInput;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (error) {
      return {
        hasLocationField: true,
        location: DEFAULT_LOCATION,
        error: 'location phải là object hoặc JSON string hợp lệ',
      };
    }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      hasLocationField: true,
      location: DEFAULT_LOCATION,
      error: 'location phải là object hợp lệ',
    };
  }

  const latRaw = raw.lat;
  const lngRaw = raw.lng;
  const lat = latRaw === undefined || latRaw === null || latRaw === '' ? null : Number(latRaw);
  const lng = lngRaw === undefined || lngRaw === null || lngRaw === '' ? null : Number(lngRaw);

  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    return {
      hasLocationField: true,
      location: DEFAULT_LOCATION,
      error: 'location.lat không hợp lệ (phải trong khoảng -90..90)',
    };
  }

  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    return {
      hasLocationField: true,
      location: DEFAULT_LOCATION,
      error: 'location.lng không hợp lệ (phải trong khoảng -180..180)',
    };
  }

  const sourceRaw = String(raw.source || 'unknown').toLowerCase();
  const source = ['gps', 'ip', 'manual', 'unknown'].includes(sourceRaw) ? sourceRaw : 'unknown';

  const location = {
    lat,
    lng,
    placeName: String(raw.placeName || '').trim(),
    city: String(raw.city || '').trim(),
    region: String(raw.region || '').trim(),
    country: String(raw.country || '').trim(),
    source,
    isApproximate: Boolean(raw.isApproximate),
  };

  const hasMeaningfulData =
    location.lat !== null ||
    location.lng !== null ||
    !!location.placeName ||
    !!location.city ||
    !!location.region ||
    !!location.country;

  return {
    hasLocationField: true,
    location: hasMeaningfulData ? location : DEFAULT_LOCATION,
    error: null,
  };
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
      Post.findOne({ _id: postId, ...ACTIVE_POST_FILTER }),
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

  static async getPostById(viewerId, postId) {
    try {
      const accessResult = await this.getViewerAndPostWithAccess(viewerId, postId);
      if (!accessResult.success) {
        return accessResult;
      }

      const populatedPost = await accessResult.post.populate([
        { path: 'author', select: 'username firstName lastName avatar' },
        SHARED_POST_POPULATE,
        COMMENT_USER_POPULATE,
      ]);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy chi tiết bài viết thành công',
        data: populatedPost,
      };
    } catch (error) {
      console.error('Get post by id error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async getPostComments(viewerId, postId) {
    try {
      const accessResult = await this.getViewerAndPostWithAccess(viewerId, postId);
      if (!accessResult.success) {
        return accessResult;
      }

      const populatedPost = await accessResult.post.populate(COMMENT_USER_POPULATE);
      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy bình luận bài viết thành công',
        data: populatedPost.comments || [],
      };
    } catch (error) {
      console.error('Get post comments error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
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
      const locationResult = normalizeLocation(payload.location);

      if (locationResult.error) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: locationResult.error,
        };
      }

      if (!ALLOWED_VISIBILITY.includes(visibility)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Chế độ hiển thị không hợp lệ. Chỉ chấp nhận: public, friends, private',
        };
      }

      const images = await Promise.all(
        (files || []).map((file) => saveFile(file, 'posts'))
      );

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
        location: locationResult.location,
        visibility,
        postType,
      });

      emitStatsUpdate('post:created', {
        postId: post._id,
        postType: post.postType,
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

      const posts = await Post.find({ author: userId, ...ACTIVE_POST_FILTER })
        .populate('author', 'username firstName lastName avatar')
        .populate(SHARED_POST_POPULATE)
        .populate(COMMENT_USER_POPULATE)
        .sort({ createdAt: -1 });

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

      const posts = await Post.find({
        ...ACTIVE_POST_FILTER,
        $or: visibilityConditions,
      })
        .populate('author', 'username firstName lastName avatar')
        .populate(SHARED_POST_POPULATE)
        .populate(COMMENT_USER_POPULATE)
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

      let query = { author: targetUserId, visibility: 'public', ...ACTIVE_POST_FILTER };

      if (isOwner) {
        query = { author: targetUserId, ...ACTIVE_POST_FILTER };
      } else if (isFriend) {
        query = {
          author: targetUserId,
          visibility: { $in: ['public', 'friends'] },
          ...ACTIVE_POST_FILTER,
        };
      }

      const posts = await Post.find(query)
        .populate('author', 'username firstName lastName avatar')
        .populate(SHARED_POST_POPULATE)
        .populate(COMMENT_USER_POPULATE)
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
      const locationResult = normalizeLocation(payload.location);

      if (locationResult.error) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: locationResult.error,
        };
      }

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
        location: locationResult.location,
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

      const post = await Post.findOne({ _id: postId, ...ACTIVE_POST_FILTER });
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
      const hasLocation = Object.prototype.hasOwnProperty.call(payload, 'location');

      if (!hasContent && !hasVisibility && !hasLocation) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Vui lòng gửi ít nhất 1 trường cần cập nhật: content, visibility hoặc location',
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

      if (hasLocation) {
        const locationResult = normalizeLocation(payload.location);
        if (locationResult.error) {
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: locationResult.error,
          };
        }
        post.location = locationResult.location;
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

      const post = await Post.findOne({ _id: postId, ...ACTIVE_POST_FILTER });
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

      const relatedShareIds = await Post.find({
        sharedPost: post._id,
        ...ACTIVE_POST_FILTER,
      }).distinct('_id');

      const idsToSoftDelete = [post._id, ...relatedShareIds];
      const deletedAt = new Date();
      await Post.updateMany(
        { _id: { $in: idsToSoftDelete }, ...ACTIVE_POST_FILTER },
        {
          $set: {
            isDeleted: true,
            deletedAt,
          },
        }
      );

      emitStatsUpdate('post:deleted', {
        postId: postId,
        reason: 'user_deleted',
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Xóa bài viết thành công',
        data: {
          deletedPostId: postId,
          deletedShareCount: relatedShareIds.length,
          hardDeleteAfterDays: 30,
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

        await NotificationService.createNotification({
          recipient: post.author,
          actor: userId,
          type: 'like',
          post: post._id,
          message: 'đã tym bài viết của bạn',
        });

        emitToPostRoom(post._id, 'post:liked', {
          postId: post._id,
          userId,
          likeCount: post.likes.length,
        });

        emitStatsUpdate('post:liked', {
          postId: post._id,
          likeCount: post.likes.length,
        });
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

        emitToPostRoom(post._id, 'post:unliked', {
          postId: post._id,
          userId,
          likeCount: post.likes.length,
        });
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
      const replyTo = payload.replyTo || null;
      if (replyTo) {
        const parentCommentExists = post.comments.some((c) => c._id.toString() === String(replyTo));
        if (!parentCommentExists) {
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Bình luận phản hồi không tồn tại trong bài viết này',
          };
        }
      }

      post.comments.push({
        user: userId,
        content,
        replyTo: replyTo || null,
      });
      await post.save();
      await post.populate(COMMENT_USER_POPULATE);

      await NotificationService.createNotification({
        recipient: post.author,
        actor: userId,
        type: 'comment',
        post: post._id,
        message: 'đã bình luận bài viết của bạn',
      });

      const newComment = post.comments[post.comments.length - 1];
      emitToPostRoom(post._id, 'post:commented', {
        postId: post._id,
        comment: newComment,
        commentCount: post.comments.length,
      });

      emitStatsUpdate('comment:added', {
        postId: post._id,
        commentCount: post.comments.length,
      });

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

      const post = await Post.findOne({ _id: postId, ...ACTIVE_POST_FILTER });
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

      emitToPostRoom(post._id, 'post:comment-deleted', {
        postId: post._id,
        deletedCommentId: commentId,
        commentCount: post.comments.length,
      });

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

  static async sharePost(userId, postId, payload = {}) {
    try {
      const accessResult = await this.getViewerAndPostWithAccess(userId, postId);
      if (!accessResult.success) {
        return accessResult;
      }

      const { post: originalPost } = accessResult;
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

      const sharedPost = await Post.create({
        author: userId,
        content,
        hashtags,
        images: [],
        visibility,
        postType: 'share',
        sharedPost: originalPost._id,
      });

      await sharedPost.populate('author', 'username firstName lastName avatar');
      await sharedPost.populate(SHARED_POST_POPULATE);

      await NotificationService.createNotification({
        recipient: originalPost.author,
        actor: userId,
        type: 'share',
        post: originalPost._id,
        message: 'đã chia sẻ bài viết của bạn',
        metadata: {
          sharedPostId: sharedPost._id,
        },
      });

      const sharedCount = await Post.countDocuments({
        sharedPost: originalPost._id,
        ...ACTIVE_POST_FILTER,
      });

      emitToPostRoom(originalPost._id, 'post:shared', {
        postId: originalPost._id,
        sharedPostId: sharedPost._id,
        sharedBy: userId,
        sharedCount,
      });

      emitToUser(userId, 'feed:new-post', {
        post: sharedPost,
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Chia sẻ bài viết thành công',
        data: sharedPost,
      };
    } catch (error) {
      console.error('Share post error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get recent posts for moderation
  static async getRecentPostsForModeration(query = {}) {
    try {
      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
      const search = String(query.search || '').trim();

      const filter = {
        isDeleted: { $ne: true },
      };

      if (search) {
        filter.$or = [
          { content: new RegExp(search, 'i') },
          { 'author.username': new RegExp(search, 'i') },
        ];
      }

      const [total, posts] = await Promise.all([
        Post.countDocuments(filter),
        Post.find(filter)
          .populate('author', 'username firstName lastName avatar email')
          .populate('comments.user', 'username firstName lastName avatar')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy danh sách bài viết thành công',
        data: {
          items: posts,
          meta: {
            page,
            limit,
            total,
            hasMore: page * limit < total,
          },
        },
      };
    } catch (error) {
      console.error('Get recent posts for moderation error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Delete post by moderator with reason
  static async deletePostByModerator(postId, moderatorId, payload = {}) {
    try {
      if (!postId || !moderatorId) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'ID bài viết hoặc moderator không hợp lệ',
        };
      }

      const post = await Post.findById(postId);

      if (!post) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Bài viết không tồn tại',
        };
      }

      if (post.isDeleted) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Bài viết đã bị xóa',
        };
      }

      const reason = String(payload.reason || 'Vi phạm chính sách cộng đồng').trim();

      post.isDeleted = true;
      post.deletedAt = new Date();
      post.deletedBy = moderatorId;
      post.deletionReason = reason;

      await post.save();

      // Notify post author
      await NotificationService.createNotification({
        recipient: post.author,
        type: 'post_deleted',
        title: 'Bài viết bị xóa',
        description: `Bài viết của bạn đã bị xóa. Lý do: ${reason}`,
        relatedPost: postId,
      });

      emitStatsUpdate('post:deleted', {
        postId: postId,
        reason: 'moderator_deleted',
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Xóa bài viết thành công',
        data: {
          postId: post._id,
          deletedAt: post.deletedAt,
          deletionReason: post.deletionReason,
        },
      };
    } catch (error) {
      console.error('Delete post by moderator error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get all posts for management (admin/moderator)
  static async getAllPostsForManagement(query = {}) {
    try {
      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
      const search = String(query.search || '').trim();
      const sortBy = String(query.sortBy || 'createdAt').toLowerCase();
      const filterDeleted = String(query.filterDeleted || 'false').toLowerCase() === 'true';

      const matchStage = {
        isDeleted: filterDeleted ? true : { $ne: true },
      };

      const basePipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
            interactionsTotal: {
              $add: [
                { $size: { $ifNull: ['$likes', []] } },
                { $size: { $ifNull: ['$comments', []] } },
              ],
            },
          },
        },
        {
          $match: matchStage,
        },
      ];

      if (search) {
        basePipeline.push({
          $match: {
            $or: [
              { content: { $regex: search, $options: 'i' } },
              { hashtags: { $regex: search, $options: 'i' } },
              { 'author.username': { $regex: search, $options: 'i' } },
              { 'author.email': { $regex: search, $options: 'i' } },
            ],
          },
        });
      }

      const sortStage =
        sortBy === 'likes'
          ? { likesCount: -1, createdAt: -1 }
          : sortBy === 'comments'
            ? { commentsCount: -1, createdAt: -1 }
            : sortBy === 'interactions'
              ? { interactionsTotal: -1, createdAt: -1 }
              : { [sortBy]: -1, createdAt: -1 };

      const totalResult = await Post.aggregate([...basePipeline, { $count: 'total' }]);
      const totalCount = totalResult[0]?.total || 0;

      const posts = await Post.aggregate([
        ...basePipeline,
        { $sort: sortStage },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              firstName: '$author.firstName',
              lastName: '$author.lastName',
              avatar: '$author.avatar',
              email: '$author.email',
            },
            content: 1,
            images: 1,
            hashtags: 1,
            location: 1,
            visibility: 1,
            postType: 1,
            sharedPost: 1,
            likes: 1,
            comments: 1,
            likesCount: 1,
            commentsCount: 1,
            interactionsTotal: 1,
            isDeleted: 1,
            deletedAt: 1,
            deletedBy: 1,
            deletionReason: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy danh sách bài viết thành công',
        data: {
          items: posts,
          meta: {
            page,
            limit,
            total: totalCount,
            hasMore: page * limit < totalCount,
          },
        },
      };
    } catch (error) {
      console.error('Get all posts for management error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Delete comment by moderator
  static async deleteCommentByModerator(postId, commentId, moderatorId, payload = {}) {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Bài viết không tồn tại',
        };
      }

      const commentIndex = post.comments.findIndex(
        (c) => c._id.toString() === commentId
      );

      if (commentIndex === -1) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Bình luận không tồn tại',
        };
      }

      const deletedComment = post.comments[commentIndex];
      post.comments.splice(commentIndex, 1);

      await post.save();

      // Notify comment author
      await NotificationService.createNotification({
        recipient: deletedComment.user,
        type: 'comment_deleted',
        title: 'Bình luận bị xóa',
        description: `Bình luận của bạn đã bị xóa. Lý do: ${String(payload.reason || 'Vi phạm chính sách cộng đồng').trim()}`,
        relatedPost: postId,
      });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Xóa bình luận thành công',
        data: {
          postId: post._id,
          deletedCommentId: commentId,
        },
      };
    } catch (error) {
      console.error('Delete comment by moderator error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get post overview (combined dashboard data)
  static async getPostOverview(query = {}) {
    try {
      const timeRange = String(query.timeRange || '90d').toLowerCase();
      const topLimit = Math.min(Math.max(Number(query.topLimit) || 5, 1), 20);
      const trendingLimit = Math.min(Math.max(Number(query.trendingLimit) || 10, 1), 50);
      const matchStage = getMatchStage(timeRange);
      const typeLabels = { image: 'Ảnh', status: 'Trạng thái', share: 'Chia sẻ', avatar_update: 'Cập nhật avatar' };

      const [summary, topPosts, postTypes, hashtags, engagement] = await Promise.all([
        Post.aggregate([
          { $match: matchStage },
          {
            $addFields: {
              likesCount: { $size: { $ifNull: ['$likes', []] } },
              commentsCount: { $size: { $ifNull: ['$comments', []] } },
            },
          },
          {
            $group: {
              _id: null,
              totalPosts: { $sum: 1 },
              totalLikes: { $sum: '$likesCount' },
              totalComments: { $sum: '$commentsCount' },
            },
          },
        ]),
        Post.aggregate([
          { $match: matchStage },
          {
            $addFields: {
              likesCount: { $size: '$likes' },
              commentsCount: { $size: '$comments' },
              interactionsTotal: { $add: [{ $size: '$likes' }, { $size: '$comments' }] },
            },
          },
          { $sort: { interactionsTotal: -1 } },
          { $limit: topLimit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              content: 1,
              images: 1,
              hashtags: 1,
              createdAt: 1,
              author: { _id: 1, username: 1, firstName: 1, lastName: 1, avatar: 1 },
              likesCount: 1,
              commentsCount: 1,
              interactionsTotal: 1,
            },
          },
        ]),
        Post.aggregate([
          { $match: matchStage },
          { $group: { _id: '$postType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Post.aggregate([
          { $match: matchStage },
          { $unwind: '$hashtags' },
          { $group: { _id: '$hashtags', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: topLimit },
        ]),
        Post.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              posts: { $sum: 1 },
              likes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
              comments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      const summaryDoc = summary[0] || { totalPosts: 0, totalLikes: 0, totalComments: 0 };

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy tổng quan thống kê bài viết thành công',
        data: {
          summary: summaryDoc,
          topPosts,
          postTypes: {
            labels: postTypes.map((item) => typeLabels[item._id] || item._id),
            values: postTypes.map((item) => item.count),
          },
          topHashtags: {
            labels: hashtags.map((item) => item._id),
            values: hashtags.map((item) => item.count),
          },
          engagementTrend: {
            labels: engagement.map((item) => item._id),
            posts: engagement.map((item) => item.posts),
            likes: engagement.map((item) => item.likes),
            comments: engagement.map((item) => item.comments),
          },
          meta: { timeRange, topLimit, trendingLimit },
        },
      };
    } catch (error) {
      console.error('Get post overview error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get trending posts (posts with highest engagement in recent time)
  static async getTrendingPosts(query = {}) {
    try {
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
      const hoursBack = Number(query.hoursBack) || 24;
      const dateFilter = { $gte: new Date(Date.now() - hoursBack * 60 * 60 * 1000) };

      const posts = await Post.aggregate([
        { $match: { ...ACTIVE_POST_FILTER, createdAt: dateFilter } },
        {
          $addFields: {
            likesCount: { $size: '$likes' },
            commentsCount: { $size: '$comments' },
            engagementScore: {
              $add: [
                { $multiply: [{ $size: '$likes' }, 1] },
                { $multiply: [{ $size: '$comments' }, 2] },
              ],
            },
          },
        },
        {
          $addFields: {
            likesCount: { $size: '$likes' },
            commentsCount: { $size: '$comments' },
            engagementScore: {
              $add: [
                { $multiply: [{ $size: '$likes' }, 1] },
                { $multiply: [{ $size: '$comments' }, 2] },
              ],
            },
          },
        },
        {
          $sort: { engagementScore: -1 },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            content: 1,
            images: 1,
            hashtags: 1,
            createdAt: 1,
            author: {
              _id: 1,
              username: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
            likesCount: 1,
            commentsCount: 1,
            engagementScore: 1,
          },
        },
      ]);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy bài viết trending thành công',
        data: {
          items: posts,
          meta: {
            hoursBack,
            total: posts.length,
          },
        },
      };
    } catch (error) {
      console.error('Get trending posts error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get posts over time for line chart
  static async getPostsOverTime(query = {}) {
    try {
      const timeRange = String(query.timeRange || '30d').toLowerCase(); // 7d, 30d, 90d
      const groupBy = String(query.groupBy || 'day').toLowerCase(); // day, week, month

      let groupStage = {};
      const dateFilter = getDateFilter(timeRange);

      if (timeRange === '7d') {
        groupStage = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      } else if (timeRange === '30d') {
        if (groupBy === 'week') {
          groupStage = { $week: '$createdAt' };
        } else if (groupBy === 'month') {
          groupStage = { $month: '$createdAt' };
        } else {
          groupStage = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        }
      } else if (timeRange === '90d') {
        groupStage = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      }

      const data = await Post.aggregate([
        { $match: { ...ACTIVE_POST_FILTER, createdAt: dateFilter } },
        {
          $group: {
            _id: groupStage,
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      const labels = data.map((d) => d._id);
      const values = data.map((d) => d.count);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy dữ liệu bài viết theo thời gian thành công',
        data: {
          labels,
          values,
          meta: { timeRange, groupBy },
        },
      };
    } catch (error) {
      console.error('Get posts over time error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get post types distribution for pie chart
  static async getPostTypesDistribution(query = {}) {
    try {
      const timeRange = String(query.timeRange || '30d').toLowerCase();
      const dateFilter = getDateFilter(timeRange);

      const data = await Post.aggregate([
        { $match: { ...ACTIVE_POST_FILTER, createdAt: dateFilter } },
        {
          $group: {
            _id: '$postType',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      const typeLabels = {
        image: 'Ảnh',
        status: 'Trạng thái',
        share: 'Chia sẻ',
        avatar_update: 'Cập nhật avatar',
      };

      const labels = data.map((d) => typeLabels[d._id] || d._id);
      const values = data.map((d) => d.count);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy phân bố loại bài viết thành công',
        data: {
          labels,
          values,
          meta: { timeRange, total: data.reduce((sum, d) => sum + d.count, 0) },
        },
      };
    } catch (error) {
      console.error('Get post types distribution error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get top hashtags for bar chart
  static async getTopHashtags(query = {}) {
    try {
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
      const timeRange = String(query.timeRange || '30d').toLowerCase();
      const dateFilter = getDateFilter(timeRange);

      const data = await Post.aggregate([
        { $match: { ...ACTIVE_POST_FILTER, createdAt: dateFilter } },
        {
          $unwind: '$hashtags',
        },
        {
          $group: {
            _id: '$hashtags',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: limit,
        },
      ]);

      const labels = data.map((d) => d._id);
      const values = data.map((d) => d.count);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy top hashtag thành công',
        data: {
          labels,
          values,
          meta: { timeRange, total: data.length },
        },
      };
    } catch (error) {
      console.error('Get top hashtags error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // Get engagement trend for line chart
  static async getEngagementTrend(query = {}) {
    try {
      const timeRange = String(query.timeRange || '30d').toLowerCase();
      const groupBy = String(query.groupBy || 'day').toLowerCase();
      const dateFilter = getDateFilter(timeRange);
      let groupStage = {};

      if (timeRange === '7d') {
        groupStage = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      } else if (timeRange === '30d') {
        if (groupBy === 'week') {
          groupStage = { $week: '$createdAt' };
        } else if (groupBy === 'month') {
          groupStage = { $month: '$createdAt' };
        } else {
          groupStage = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        }
      } else if (timeRange === '90d') {
        groupStage = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      }

      const data = await Post.aggregate([
        { $match: { ...ACTIVE_POST_FILTER, createdAt: dateFilter } },
        {
          $addFields: {
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
          },
        },
        {
          $group: {
            _id: groupStage,
            totalLikes: { $sum: '$likesCount' },
            totalComments: { $sum: '$commentsCount' },
            avgEngagement: {
              $avg: {
                $add: ['$likesCount', '$commentsCount'],
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      const labels = data.map((d) => d._id);
      const likes = data.map((d) => d.totalLikes);
      const comments = data.map((d) => d.totalComments);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy xu hướng tương tác thành công',
        data: {
          labels,
          likes,
          comments,
          meta: { timeRange, groupBy },
        },
      };
    } catch (error) {
      console.error('Get engagement trend error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async searchPosts(userId, query = {}) {
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

      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
      const search = String(query.q || '').trim();

      if (!search) {
        return {
          success: true,
          statusCode: HTTP_STATUS.OK,
          message: 'Lấy danh sách bài viết thành công',
          data: {
            items: [],
            meta: {
              page,
              limit,
              total: 0,
              hasMore: false,
            },
          },
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

      const searchRegex = new RegExp(search, 'i');
      const filter = {
        ...ACTIVE_POST_FILTER,
        $or: visibilityConditions,
        $and: [
          {
            $or: [
              { content: searchRegex },
              { hashtags: searchRegex },
            ],
          },
        ],
      };

      const [total, posts] = await Promise.all([
        Post.countDocuments(filter),
        Post.find(filter)
          .populate('author', 'username firstName lastName avatar')
          .populate(SHARED_POST_POPULATE)
          .populate(COMMENT_USER_POPULATE)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Tìm kiếm bài viết thành công',
        data: {
          items: posts,
          meta: {
            page,
            limit,
            total,
            hasMore: page * limit < total,
          },
        },
      };
    } catch (error) {
      console.error('Search posts error:', error);
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
