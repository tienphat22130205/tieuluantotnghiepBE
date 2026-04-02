const FriendRequest = require('./friend.model');
const User = require('../auth/auth.model');

const FRIEND_REQUEST_ACTIONS = ['accepted', 'declined'];
const USER_SUMMARY_FIELDS = 'username email avatar firstName lastName';

class FriendService {
  assertNotSelfAction(userId, targetUserId, message) {
    if (userId.toString() === targetUserId.toString()) {
      throw new Error(message);
    }
  }

  async getUserOrThrow(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    return user;
  }

  async getUsersByRelationIds(ids = []) {
    return User.find(
      { _id: { $in: ids } },
      USER_SUMMARY_FIELDS
    );
  }

  hasRelation(user = null, targetUserId = null, field = 'friends') {
    if (!user || !targetUserId || !Array.isArray(user[field])) {
      return false;
    }

    return user[field].some((id) => id.toString() === targetUserId.toString());
  }

  async cleanupMutualLinks(userId, targetUserId) {
    await Promise.all([
      User.findByIdAndUpdate(userId, {
        $pull: {
          friends: targetUserId,
          following: targetUserId,
          followers: targetUserId,
        },
      }),
      User.findByIdAndUpdate(targetUserId, {
        $pull: {
          friends: userId,
          following: userId,
          followers: userId,
        },
      }),
    ]);
  }

  /**
   * Send a friend request from one user to another
   */
  async sendFriendRequest(fromId, toId) {
    this.assertNotSelfAction(fromId, toId, 'Không thể gửi lời mời kết bạn cho chính mình');

    // Check both users and read current relation state from both sides.
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromId).select('_id friends'),
      User.findById(toId).select('_id friends'),
    ]);

    if (!fromUser || !toUser) {
      throw new Error('Người dùng không tồn tại');
    }

    const fromHasFriend = this.hasRelation(fromUser, toId, 'friends');
    const toHasFriend = this.hasRelation(toUser, fromId, 'friends');

    if (fromHasFriend && toHasFriend) {
      throw new Error('Bạn đã là bạn bè');
    }

    // If relation is stale on one side, normalize before creating a new request.
    if (fromHasFriend || toHasFriend) {
      await this.cleanupMutualLinks(fromId, toId);
    }

    // Check pending request in either direction
    const existingPendingRequest = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId },
        { from: toId, to: fromId },
      ],
      status: 'pending',
    });

    if (existingPendingRequest) {
      if (existingPendingRequest.from.toString() === fromId.toString()) {
        throw new Error('Lời mời kết bạn đã được gửi');
      }
      throw new Error('Bạn đã nhận được lời mời từ người này, vui lòng chấp nhận hoặc từ chối trước');
    }

    // Reuse latest request in same direction (if exists) to avoid duplicate history conflicts,
    // otherwise create a new one.
    const friendRequest = await FriendRequest.findOneAndUpdate(
      { from: fromId, to: toId },
      {
        from: fromId,
        to: toId,
        status: 'pending',
        respondedAt: null,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return friendRequest.populate(['from', 'to']);
  }

  /**
   * Respond to a friend request (accept or decline)
   */
  async respondFriendRequest(requestId, userId, action) {
    // 'action' should be 'accepted' or 'declined'
    if (!FRIEND_REQUEST_ACTIONS.includes(action)) {
      throw new Error('Hành động không hợp lệ');
    }

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      throw new Error('Lời mời kết bạn không tồn tại');
    }

    // Check if user is the recipient
    if (friendRequest.to.toString() !== userId.toString()) {
      throw new Error('Bạn không có quyền xử lý lời mời này');
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
      throw new Error('Lời mời kết bạn đã được xử lý');
    }

    // Update request status
    friendRequest.status = action;
    friendRequest.respondedAt = new Date();
    await friendRequest.save();

    if (action === 'accepted') {
      // Update both users' friend relationships
      await User.findByIdAndUpdate(friendRequest.from, {
        $addToSet: { friends: friendRequest.to },
      });
      await User.findByIdAndUpdate(friendRequest.to, {
        $addToSet: { friends: friendRequest.from },
      });

      // Auto-follow each other when becoming friends
      await User.findByIdAndUpdate(friendRequest.from, {
        $addToSet: {
          following: friendRequest.to,
          followers: friendRequest.to,
        },
      });
      await User.findByIdAndUpdate(friendRequest.to, {
        $addToSet: {
          following: friendRequest.from,
          followers: friendRequest.from,
        },
      });
    }

    return friendRequest.populate(['from', 'to']);
  }

  /**
   * Get all accepted friends of a user
   */
  async getFriendsByUserId(userId) {
    const user = await User.findById(userId).select('friends');
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    return this.getUsersByRelationIds(user.friends);
  }

  /**
   * Get pending friend requests for a user
   */
  async getPendingRequests(userId) {
    const requests = await FriendRequest.find({
      to: userId,
      status: 'pending',
    })
      .populate('from', USER_SUMMARY_FIELDS)
      .sort({ createdAt: -1 });

    return requests;
  }

  /**
   * Get sent friend requests that are pending
   */
  async getSentFriendRequests(userId) {
    const requests = await FriendRequest.find({
      from: userId,
      status: 'pending',
    })
      .populate('to', USER_SUMMARY_FIELDS)
      .sort({ createdAt: -1 });

    return requests;
  }

  /**
   * Follow a user
   */
  async followUser(userId, targetUserId) {
    this.assertNotSelfAction(userId, targetUserId, 'Không thể theo dõi chính mình');

    // Check if target user exists
    await this.getUserOrThrow(targetUserId);

    // Add targetUserId to user's following list
    // Add userId to targetUser's followers list
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { following: targetUserId } },
      { new: true }
    );

    await User.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { followers: userId } },
      { new: true }
    );

    return { message: 'Đã theo dõi thành công' };
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(userId, targetUserId) {
    this.assertNotSelfAction(userId, targetUserId, 'Không thể bỏ theo dõi chính mình');

    await User.findByIdAndUpdate(userId, {
      $pull: { following: targetUserId },
    });

    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: userId },
    });

    return { message: 'Đã bỏ theo dõi thành công' };
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId1, userId2) {
    const [user1, user2] = await Promise.all([
      User.findById(userId1).select('friends'),
      User.findById(userId2).select('friends'),
    ]);

    if (!user1 || !user2) {
      return false;
    }

    const user1HasUser2 = this.hasRelation(user1, userId2, 'friends');
    const user2HasUser1 = this.hasRelation(user2, userId1, 'friends');

    return user1HasUser2 && user2HasUser1;
  }

  /**
   * Get user's followers
   */
  async getFollowers(userId) {
    const user = await User.findById(userId).select('followers');
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    return this.getUsersByRelationIds(user.followers);
  }

  /**
   * Get user's following
   */
  async getFollowing(userId) {
    const user = await User.findById(userId).select('following');
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    return this.getUsersByRelationIds(user.following);
  }

  /**
   * Get friend request status between two users
   */
  async getFriendStatus(userId, targetUserId) {
    // Check if they are friends
    const areFriendsResult = await this.areFriends(userId, targetUserId);
    if (areFriendsResult) {
      return 'friends';
    }

    // Check pending requests
    const pendingRequest = await FriendRequest.findOne({
      $or: [
        { from: userId, to: targetUserId },
        { from: targetUserId, to: userId },
      ],
      status: 'pending',
    });

    if (pendingRequest) {
      if (pendingRequest.from.toString() === userId.toString()) {
        return 'request_sent';
      } else {
        return 'request_received';
      }
    }

    // Check if following
    const user = await User.findById(userId).select('following');
    if (user && user.following.includes(targetUserId)) {
      return 'following';
    }

    return 'none';
  }

  /**
   * Cancel a sent friend request
   */
  async cancelFriendRequest(requestId, userId) {
    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      throw new Error('Lời mời kết bạn không tồn tại');
    }

    if (friendRequest.from.toString() !== userId.toString()) {
      throw new Error('Bạn không có quyền hủy lời mời này');
    }

    if (friendRequest.status !== 'pending') {
      throw new Error('Chỉ có thể hủy lời mời đang chờ');
    }

    friendRequest.status = 'cancelled';
    await friendRequest.save();

    return friendRequest;
  }

  /**
   * Unfriend a user (remove bidirectional friendship)
   */
  async unfriendUser(userId, targetUserId) {
    this.assertNotSelfAction(userId, targetUserId, 'Không thể hủy kết bạn chính mình');

    const [user, targetUser] = await Promise.all([
      User.findById(userId).select('_id friends followers following'),
      User.findById(targetUserId).select('_id friends followers following'),
    ]);

    if (!user || !targetUser) {
      throw new Error('Người dùng không tồn tại');
    }

    const userHasTargetFriend = this.hasRelation(user, targetUserId, 'friends');
    const targetHasUserFriend = this.hasRelation(targetUser, userId, 'friends');
    const hasFriendRelation = userHasTargetFriend || targetHasUserFriend;

    if (!hasFriendRelation) {
      throw new Error('Hai người chưa là bạn bè');
    }

    await this.cleanupMutualLinks(userId, targetUserId);

    return { message: 'Hủy kết bạn thành công' };
  }
}

module.exports = new FriendService();
