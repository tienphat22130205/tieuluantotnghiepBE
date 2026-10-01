const mongoose = require('mongoose');
const User = require('../auth/auth.model');
const Post = require('../post/post.model');
const { HTTP_STATUS, MESSAGES } = require('../../constants');

const getMutualFriendIds = (followers = [], following = []) => {
  const followerIdSet = new Set(followers.map((id) => id.toString()));
  return following
    .map((id) => id.toString())
    .filter((id) => followerIdSet.has(id));
};

const mapProfileResponse = (user, postCount, postImages, friendCount, friends) => {
  return {
    id: user._id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    avatar: user.avatar,
    bio: user.bio,
    location: user.location,
    role: user.role,
    verified: user.verified,
    stats: {
      postCount,
      followerCount: user.followers.length,
      followingCount: user.following.length,
      friendCount,
    },
    postImages,
    friends,
    lastPasswordChangedAt: user.lastPasswordChangedAt || null,
    lastProfileInfoChangedAt: user.lastProfileInfoChangedAt || null,
  };
};

class ProfileService {
  static async getProfileByUserId(identifier) {
    try {
      if (!identifier) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Thông tin người dùng không hợp lệ',
        };
      }

      const cleanIdentifier = String(identifier).trim().replace(/^@/, '');
      let user = null;

      if (mongoose.Types.ObjectId.isValid(cleanIdentifier)) {
        user = await User.findById(cleanIdentifier)
          .populate('followers', 'username firstName lastName avatar')
          .populate('following', 'username firstName lastName avatar');
      }

      if (!user) {
        user = await User.findOne({
          username: { $regex: new RegExp(`^${cleanIdentifier}$`, 'i') },
        })
          .populate('followers', 'username firstName lastName avatar')
          .populate('following', 'username firstName lastName avatar');
      }

      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      const posts = await Post.find({ author: user._id })
        .sort({ createdAt: -1 })
        .select('images createdAt');

      const postCount = posts.length;
      const postImages = posts.flatMap((post) => post.images || []);

      const mutualFriendIds = getMutualFriendIds(user.followers, user.following);
      const friendCount = mutualFriendIds.length;

      const friends = user.following
        .filter((u) => mutualFriendIds.includes(u._id.toString()))
        .slice(0, 20)
        .map((u) => ({
          id: u._id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.avatar,
        }));

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy profile thành công',
        data: mapProfileResponse(user, postCount, postImages, friendCount, friends),
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async updateMyProfile(userId, payload) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      // Check if user is attempting to change name or date of birth
      const isNameChanged =
        (payload.firstName !== undefined && payload.firstName.trim() !== (user.firstName || '').trim()) ||
        (payload.lastName !== undefined && payload.lastName.trim() !== (user.lastName || '').trim());

      const currentDobStr = user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '';
      const newDobStr = payload.dateOfBirth ? new Date(payload.dateOfBirth).toISOString().split('T')[0] : '';
      const isDobChanged = payload.dateOfBirth !== undefined && newDobStr !== currentDobStr;

      if ((isNameChanged || isDobChanged) && user.lastProfileInfoChangedAt) {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(user.lastProfileInfoChangedAt).getTime();
        if (elapsed < THIRTY_DAYS_MS) {
          const daysRemaining = Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000));
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: `Bạn chỉ có thể đổi họ tên hoặc ngày sinh 30 ngày một lần. Vui lòng thử lại sau ${daysRemaining} ngày nữa.`,
            daysRemaining,
          };
        }
      }

      const allowedFields = ['firstName', 'lastName', 'avatar', 'bio', 'dateOfBirth'];
      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          if (field === 'dateOfBirth') {
            if (payload.dateOfBirth) {
              const parsedDate = new Date(payload.dateOfBirth);
              user.dateOfBirth = !isNaN(parsedDate.getTime()) ? parsedDate : user.dateOfBirth;
            } else {
              user.dateOfBirth = null;
            }
          } else {
            user[field] = payload[field];
          }
        }
      }

      if (isNameChanged || isDobChanged) {
        user.lastProfileInfoChangedAt = new Date();
      }

      if (payload.location && typeof payload.location === 'object') {
        user.location = {
          lat: typeof payload.location.lat === 'number' ? payload.location.lat : user.location?.lat || null,
          lng: typeof payload.location.lng === 'number' ? payload.location.lng : user.location?.lng || null,
          address: payload.location.address || user.location?.address || '',
          city: payload.location.city || user.location?.city || '',
          country: payload.location.country || user.location?.country || '',
          updatedAt: new Date(),
        };
      }

      await user.save();
      return this.getProfileByUserId(user._id);
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async updateMyAvatar(userId, avatarUrl, payload = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      user.avatar = avatarUrl;
      await user.save();

      const visibility = String(payload.visibility || 'public').toLowerCase();
      const allowedVisibility = ['public', 'friends', 'private'];
      const normalizedVisibility = allowedVisibility.includes(visibility) ? visibility : 'public';

      let hashtags = [];
      if (payload.hashtags) {
        if (Array.isArray(payload.hashtags)) {
          hashtags = payload.hashtags;
        } else if (typeof payload.hashtags === 'string') {
          try {
            const parsed = JSON.parse(payload.hashtags);
            hashtags = Array.isArray(parsed) ? parsed : payload.hashtags.split(',');
          } catch (error) {
            hashtags = payload.hashtags.split(',');
          }
        }
      }

      const normalizedHashtags = [...new Set(hashtags
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
        .map((item) => (item.startsWith('#') ? item : `#${item}`)))].slice(0, 20);

      await Post.create({
        author: user._id,
        content: String(payload.content || 'Đã cập nhật ảnh đại diện').trim(),
        hashtags: normalizedHashtags,
        images: [avatarUrl],
        visibility: normalizedVisibility,
        postType: 'avatar_update',
      });

      return this.getProfileByUserId(user._id);
    } catch (error) {
      console.error('Update avatar error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async removeMyAvatar(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      user.avatar = null;
      await user.save();

      return this.getProfileByUserId(user._id);
    } catch (error) {
      console.error('Remove avatar error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
}

module.exports = ProfileService;
