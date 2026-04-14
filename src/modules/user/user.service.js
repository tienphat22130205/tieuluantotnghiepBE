const User = require('../auth/auth.model');
const FriendRequest = require('../friend/friend.model');
const { HTTP_STATUS } = require('../../constants');

class UserService {
  static async searchUsers(currentUserId, query) {
    const q = String(query.q || '').trim();
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);

    if (q.length < 2) {
      return {
        success: true,
        statusCode: 200,
        message: 'Từ khóa quá ngắn',
        data: {
          items: [],
          meta: { page, limit, total: 0, hasMore: false },
        },
      };
    }

    const currentUser = await User.findById(currentUserId).select('friends following');
    if (!currentUser) {
      return {
        success: false,
        statusCode: 404,
        message: 'Người dùng không tồn tại',
      };
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter = {
      _id: { $ne: currentUserId },
      isActive: true,
      $or: [
        { username: regex },
        { firstName: regex },
        { lastName: regex },
      ],
    };

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('username firstName lastName avatar bio isOnline lastSeen')
        .sort({ username: 1, firstName: 1, lastName: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const targetIds = users.map((u) => u._id);
    const pendingRequests = await FriendRequest.find({
      status: 'pending',
      $or: [
        { from: currentUserId, to: { $in: targetIds } },
        { from: { $in: targetIds }, to: currentUserId },
      ],
    }).select('from to');

    const friendSet = new Set((currentUser.friends || []).map((id) => id.toString()));
    const followingSet = new Set((currentUser.following || []).map((id) => id.toString()));

    const sentSet = new Set();
    const receivedSet = new Set();
    pendingRequests.forEach((req) => {
      const from = req.from.toString();
      const to = req.to.toString();
      if (from === currentUserId.toString()) {
        sentSet.add(to);
      } else {
        receivedSet.add(from);
      }
    });

    const items = users.map((u) => {
      const id = u._id.toString();
      let friendStatus = 'none';
      if (friendSet.has(id)) {
        friendStatus = 'friends';
      } else if (sentSet.has(id)) {
        friendStatus = 'request_sent';
      } else if (receivedSet.has(id)) {
        friendStatus = 'request_received';
      } else if (followingSet.has(id)) {
        friendStatus = 'following';
      }

      return {
        id: u._id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        avatar: u.avatar,
        bio: u.bio,
        isOnline: !!u.isOnline,
        lastSeen: u.lastSeen || null,
        friendStatus,
      };
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Tìm kiếm tài khoản thành công',
      data: {
        items,
        meta: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      },
    };
  }

  static async getUserPresence(_currentUserId, targetUserId) {
    const user = await User.findOne({
      _id: targetUserId,
      isActive: true,
    }).select('isOnline lastSeen');

    if (!user) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Người dùng không tồn tại',
      };
    }

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy trạng thái hoạt động thành công',
      data: {
        userId: targetUserId,
        isOnline: !!user.isOnline,
        lastSeen: user.lastSeen || null,
      },
    };
  }

  static async getUsersPresence(_currentUserId, query = {}) {
    const rawIds = String(query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const uniqueIds = [...new Set(rawIds)].slice(0, 100);

    if (uniqueIds.length === 0) {
      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Danh sách user rỗng',
        data: {
          items: [],
        },
      };
    }

    const users = await User.find({
      _id: { $in: uniqueIds },
      isActive: true,
    }).select('_id isOnline lastSeen');

    const presenceMap = new Map(
      users.map((u) => [
        u._id.toString(),
        {
          userId: u._id,
          isOnline: !!u.isOnline,
          lastSeen: u.lastSeen || null,
        },
      ])
    );

    const items = uniqueIds.map((userId) => presenceMap.get(userId) || {
      userId,
      isOnline: false,
      lastSeen: null,
      unavailable: true,
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách trạng thái hoạt động thành công',
      data: {
        items,
      },
    };
  }
}

module.exports = UserService;
