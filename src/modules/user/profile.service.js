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
  };
};

class ProfileService {
  static async getProfileByUserId(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'User ID không hợp lệ',
        };
      }

      const user = await User.findById(userId)
        .populate('followers', 'username firstName lastName avatar')
        .populate('following', 'username firstName lastName avatar');

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

      const allowedFields = ['firstName', 'lastName', 'avatar', 'bio'];
      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          user[field] = payload[field];
        }
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

  static async updateMyAvatar(userId, avatarUrl) {
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
}

module.exports = ProfileService;
