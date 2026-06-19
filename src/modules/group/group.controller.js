const GroupService = require('./group.service');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS } = require('../../constants');

const handleResult = (res, result) => {
  if (result.success) {
    return sendSuccess(res, result.statusCode, result.message, result.data || null);
  }
  return sendError(res, result.statusCode, result.message);
};

class GroupController {
  // ── Group CRUD ──
  static async createGroup(req, res) {
    const result = await GroupService.createGroup(req.user.id, req.body, req.files);
    handleResult(res, result);
  }

  static async getGroupById(req, res) {
    const result = await GroupService.getGroupById(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  static async searchGroups(req, res) {
    const result = await GroupService.searchGroups(req.query);
    handleResult(res, result);
  }

  static async getMyGroups(req, res) {
    const result = await GroupService.getMyGroups(req.user.id, req.query);
    handleResult(res, result);
  }

  static async updateGroup(req, res) {
    const result = await GroupService.updateGroup(req.params.groupId, req.user.id, req.body, req.files);
    handleResult(res, result);
  }

  static async deleteGroup(req, res) {
    const result = await GroupService.deleteGroup(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  // ── Membership ──
  static async joinGroup(req, res) {
    const result = await GroupService.joinGroup(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  static async leaveGroup(req, res) {
    const result = await GroupService.leaveGroup(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  static async getMembers(req, res) {
    const result = await GroupService.getMembers(req.params.groupId, req.query);
    handleResult(res, result);
  }

  static async getPendingMembers(req, res) {
    const result = await GroupService.getPendingMembers(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  static async approveMember(req, res) {
    const result = await GroupService.approveMember(req.params.groupId, req.user.id, req.params.userId);
    handleResult(res, result);
  }

  static async rejectMember(req, res) {
    const result = await GroupService.rejectMember(req.params.groupId, req.user.id, req.params.userId);
    handleResult(res, result);
  }

  static async banMember(req, res) {
    const result = await GroupService.banMember(req.params.groupId, req.user.id, req.params.userId);
    handleResult(res, result);
  }

  static async promoteMember(req, res) {
    const result = await GroupService.promoteMember(req.params.groupId, req.user.id, req.params.userId);
    handleResult(res, result);
  }

  static async demoteMember(req, res) {
    const result = await GroupService.demoteMember(req.params.groupId, req.user.id, req.params.userId);
    handleResult(res, result);
  }

  // ── Group Posts ──
  static async createGroupPost(req, res) {
    const result = await GroupService.createGroupPost(req.params.groupId, req.user.id, req.body, req.files);
    handleResult(res, result);
  }

  static async getGroupPosts(req, res) {
    const result = await GroupService.getGroupPosts(req.params.groupId, req.user.id, req.query);
    handleResult(res, result);
  }

  static async deleteGroupPost(req, res) {
    const result = await GroupService.deleteGroupPost(req.params.groupId, req.params.postId, req.user.id);
    handleResult(res, result);
  }

  static async pinGroupPost(req, res) {
    const result = await GroupService.pinGroupPost(req.params.groupId, req.params.postId, req.user.id);
    handleResult(res, result);
  }

  static async likeGroupPost(req, res) {
    const result = await GroupService.likeGroupPost(req.params.groupId, req.params.postId, req.user.id);
    handleResult(res, result);
  }

  static async unlikeGroupPost(req, res) {
    const result = await GroupService.unlikeGroupPost(req.params.groupId, req.params.postId, req.user.id);
    handleResult(res, result);
  }

  static async addGroupComment(req, res) {
    const result = await GroupService.addGroupComment(
      req.params.groupId, req.params.postId, req.user.id, req.body.content
    );
    handleResult(res, result);
  }

  static async deleteGroupComment(req, res) {
    const result = await GroupService.deleteGroupComment(
      req.params.groupId, req.params.postId, req.params.commentId, req.user.id
    );
    handleResult(res, result);
  }

  // ── Chat ──
  static async getGroupMessages(req, res) {
    const result = await GroupService.getGroupMessages(req.params.groupId, req.user.id, req.query);
    handleResult(res, result);
  }

  static async sendGroupMessage(req, res) {
    const result = await GroupService.sendGroupMessage(req.params.groupId, req.user.id, req.body);
    handleResult(res, result);
  }

  // ── Polls ──
  static async createPoll(req, res) {
    const result = await GroupService.createPoll(req.params.groupId, req.user.id, req.body);
    handleResult(res, result);
  }

  static async getGroupPolls(req, res) {
    const result = await GroupService.getGroupPolls(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  static async votePoll(req, res) {
    const result = await GroupService.votePoll(
      req.params.groupId, req.params.pollId, req.user.id, req.body.optionIds
    );
    handleResult(res, result);
  }

  static async closePoll(req, res) {
    const result = await GroupService.closePoll(req.params.groupId, req.params.pollId, req.user.id);
    handleResult(res, result);
  }

  // ── Events ──
  static async createEvent(req, res) {
    const result = await GroupService.createEvent(req.params.groupId, req.user.id, req.body, req.files);
    handleResult(res, result);
  }

  static async getGroupEvents(req, res) {
    const result = await GroupService.getGroupEvents(req.params.groupId, req.user.id);
    handleResult(res, result);
  }

  static async respondToEvent(req, res) {
    const result = await GroupService.respondToEvent(
      req.params.groupId, req.params.eventId, req.user.id, req.body.status
    );
    handleResult(res, result);
  }
}

module.exports = GroupController;
