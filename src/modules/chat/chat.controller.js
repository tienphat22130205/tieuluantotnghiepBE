const ChatService = require('./chat.service');
const { sendSuccess, sendError } = require('../../utils/response');

class ChatController {
  static async getOrCreateDirectConversation(req, res) {
    try {
      const result = await ChatService.getOrCreateDirectConversation(req.user.id, req.body?.targetUserId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getMyConversations(req, res) {
    try {
      const result = await ChatService.getMyConversations(req.user.id, req.query || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async getConversationMessages(req, res) {
    try {
      const result = await ChatService.getConversationMessages(req.user.id, req.params.conversationId, req.query || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async sendMessage(req, res) {
    try {
      const result = await ChatService.sendMessage(req.user.id, req.params.conversationId, req.body || {});
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }

  static async markConversationAsRead(req, res) {
    try {
      const result = await ChatService.markConversationAsRead(req.user.id, req.params.conversationId);
      if (!result.success) {
        return sendError(res, result.statusCode, result.message, result.error);
      }
      return sendSuccess(res, result.statusCode, result.message, result.data);
    } catch (error) {
      return sendError(res, 500, 'Lỗi máy chủ nội bộ', error.message);
    }
  }
}

module.exports = ChatController;
