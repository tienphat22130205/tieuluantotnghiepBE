const friendService = require('./friend.service');

class FriendController {
  /**
   * Send friend request
   * POST /api/friends/requests
   */
  async sendFriendRequest(req, res) {
    try {
      const { toUserId } = req.body;
      const fromUserId = req.user.id;

      if (!toUserId) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp ID người dùng',
        });
      }

      const friendRequest = await friendService.sendFriendRequest(
        fromUserId,
        toUserId
      );

      res.status(201).json({
        success: true,
        message: 'Lời mời kết bạn đã được gửi',
        data: friendRequest,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get pending friend requests for current user
   * GET /api/friends/requests
   */
  async getPendingRequests(req, res) {
    try {
      const userId = req.user.id;
      const requests = await friendService.getPendingRequests(userId);

      res.status(200).json({
        success: true,
        data: requests,
        count: requests.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get sent friend requests (pending)
   * GET /api/friends/requests/sent
   */
  async getSentFriendRequests(req, res) {
    try {
      const userId = req.user.id;
      const requests = await friendService.getSentFriendRequests(userId);

      res.status(200).json({
        success: true,
        data: requests,
        count: requests.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Accept/Decline friend request
   * PATCH /api/friends/requests/:requestId
   */
  async respondFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { action } = req.body; // 'accepted' or 'declined'
      const userId = req.user.id;

      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp hành động (accepted hoặc declined)',
        });
      }

      const friendRequest = await friendService.respondFriendRequest(
        requestId,
        userId,
        action
      );

      res.status(200).json({
        success: true,
        message: `Lời mời kết bạn đã được ${action === 'accepted' ? 'chấp nhận' : 'từ chối'}`,
        data: friendRequest,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Cancel a sent friend request
   * DELETE /api/friends/requests/:requestId
   */
  async cancelFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;

      const friendRequest = await friendService.cancelFriendRequest(
        requestId,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Lời mời kết bạn đã được hủy',
        data: friendRequest,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get friends list of current user
   * GET /api/friends
   */
  async getFriends(req, res) {
    try {
      const userId = req.user.id;
      const friends = await friendService.getFriendsByUserId(userId);

      res.status(200).json({
        success: true,
        data: friends,
        count: friends.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get friends list of a specific user
   * GET /api/friends/:userId
   */
  async getFriendsOfUser(req, res) {
    try {
      const { userId } = req.params;
      const friends = await friendService.getFriendsByUserId(userId);

      res.status(200).json({
        success: true,
        data: friends,
        count: friends.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Follow a user
   * POST /api/friends/follow/:userId
   */
  async followUser(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      await friendService.followUser(currentUserId, userId);

      res.status(200).json({
        success: true,
        message: 'Đã theo dõi thành công',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Unfollow a user
   * DELETE /api/friends/follow/:userId
   */
  async unfollowUser(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      await friendService.unfollowUser(currentUserId, userId);

      res.status(200).json({
        success: true,
        message: 'Đã bỏ theo dõi thành công',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get followers of current user
   * GET /api/friends/followers
   */
  async getFollowers(req, res) {
    try {
      const userId = req.user.id;
      const followers = await friendService.getFollowers(userId);

      res.status(200).json({
        success: true,
        data: followers,
        count: followers.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get followers of a specific user
   * GET /api/friends/followers/:userId
   */
  async getFollowersOfUser(req, res) {
    try {
      const { userId } = req.params;
      const followers = await friendService.getFollowers(userId);

      res.status(200).json({
        success: true,
        data: followers,
        count: followers.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get following of current user
   * GET /api/friends/following
   */
  async getFollowing(req, res) {
    try {
      const userId = req.user.id;
      const following = await friendService.getFollowing(userId);

      res.status(200).json({
        success: true,
        data: following,
        count: following.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get following of a specific user
   * GET /api/friends/following/:userId
   */
  async getFollowingOfUser(req, res) {
    try {
      const { userId } = req.params;
      const following = await friendService.getFollowing(userId);

      res.status(200).json({
        success: true,
        data: following,
        count: following.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get friend status between current user and another user
   * GET /api/friends/status/:userId
   */
  async getFriendStatus(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      const status = await friendService.getFriendStatus(currentUserId, userId);

      res.status(200).json({
        success: true,
        data: { status },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Unfriend a user
   * DELETE /api/friends/:userId
   */
  async unfriendUser(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      await friendService.unfriendUser(currentUserId, userId);

      res.status(200).json({
        success: true,
        message: 'Đã hủy kết bạn thành công',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new FriendController();
