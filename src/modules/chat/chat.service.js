const mongoose = require('mongoose');
const ChatConversation = require('./chat-conversation.model');
const ChatMessage = require('./chat-message.model');
const User = require('../auth/auth.model');
const { HTTP_STATUS, MESSAGES } = require('../../constants');
const { emitToChatRoom, emitToUser } = require('../../realtime/socket');

const PARTICIPANT_FIELDS = 'username firstName lastName avatar isOnline lastSeen';
const MESSAGE_SENDER_FIELDS = 'username firstName lastName avatar';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const mapConversation = (conversation) => ({
  id: conversation._id,
  type: conversation.type,
  participants: conversation.participants,
  lastMessage: conversation.lastMessage,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

class ChatService {
  static async getOrCreateDirectConversation(userId, targetUserId) {
    if (!isValidObjectId(userId) || !isValidObjectId(targetUserId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID không hợp lệ',
      };
    }

    if (userId.toString() === targetUserId.toString()) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Không thể chat với chính mình',
      };
    }

    const targetUser = await User.findOne({ _id: targetUserId, isActive: true }).select('_id');
    if (!targetUser) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: MESSAGES.USER_NOT_FOUND,
      };
    }

    let conversation = await ChatConversation.findOne({
      type: 'direct',
      participants: { $all: [userId, targetUserId] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    })
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessage.sender', MESSAGE_SENDER_FIELDS);

    if (!conversation) {
      conversation = await ChatConversation.create({
        type: 'direct',
        participants: [userId, targetUserId],
      });
      conversation = await ChatConversation.findById(conversation._id)
        .populate('participants', PARTICIPANT_FIELDS)
        .populate('lastMessage.sender', MESSAGE_SENDER_FIELDS);
    }

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy cuộc trò chuyện thành công',
      data: mapConversation(conversation),
    };
  }

  static async getMyConversations(userId, query = {}) {
    if (!isValidObjectId(userId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID không hợp lệ',
      };
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const filter = {
      participants: new mongoose.Types.ObjectId(userId),
    };

    const [total, conversations] = await Promise.all([
      ChatConversation.countDocuments(filter),
      ChatConversation.find(filter)
        .populate('participants', PARTICIPANT_FIELDS)
        .populate('lastMessage.sender', MESSAGE_SENDER_FIELDS)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách cuộc trò chuyện thành công',
      data: {
        items: conversations.map(mapConversation),
        meta: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      },
    };
  }

  static async getConversationMessages(userId, conversationId, query = {}) {
    if (!isValidObjectId(userId) || !isValidObjectId(conversationId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID hoặc Conversation ID không hợp lệ',
      };
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      participants: userId,
    })
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessage.sender', MESSAGE_SENDER_FIELDS);

    if (!conversation) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy cuộc trò chuyện',
      };
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);

    const filter = {
      conversation: conversationId,
      isDeleted: { $ne: true },
    };

    const [total, messages] = await Promise.all([
      ChatMessage.countDocuments(filter),
      ChatMessage.find(filter)
        .populate('sender', MESSAGE_SENDER_FIELDS)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy tin nhắn thành công',
      data: {
        conversation: mapConversation(conversation),
        items: messages.reverse(),
        meta: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      },
    };
  }

  static async sendMessage(userId, conversationId, payload = {}) {
    if (!isValidObjectId(userId) || !isValidObjectId(conversationId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID hoặc Conversation ID không hợp lệ',
      };
    }

    const content = String(payload.content || '').trim();
    if (!content) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Nội dung tin nhắn không được để trống',
      };
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      participants: userId,
    }).select('participants type');

    if (!conversation) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy cuộc trò chuyện',
      };
    }

    let message = await ChatMessage.create({
      conversation: conversationId,
      sender: userId,
      content,
      readBy: [
        {
          user: userId,
          readAt: new Date(),
        },
      ],
    });

    message = await ChatMessage.findById(message._id).populate('sender', MESSAGE_SENDER_FIELDS);

    await ChatConversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessage: {
            content,
            sender: userId,
            createdAt: message.createdAt,
          },
          updatedAt: new Date(),
        },
      }
    );

    emitToChatRoom(conversationId, 'chat:message:new', {
      conversationId,
      message,
    });

    conversation.participants.forEach((participantId) => {
      emitToUser(participantId, 'chat:conversation:updated', {
        conversationId,
        lastMessage: {
          content,
          sender: userId,
          createdAt: message.createdAt,
        },
      });
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Gửi tin nhắn thành công',
      data: {
        conversationId,
        message,
      },
    };
  }

  static async markConversationAsRead(userId, conversationId) {
    if (!isValidObjectId(userId) || !isValidObjectId(conversationId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID hoặc Conversation ID không hợp lệ',
      };
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      participants: userId,
    }).select('_id');

    if (!conversation) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy cuộc trò chuyện',
      };
    }

    await ChatMessage.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        readBy: {
          $not: {
            $elemMatch: {
              user: new mongoose.Types.ObjectId(userId),
            },
          },
        },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      }
    );

    emitToChatRoom(conversationId, 'chat:conversation:read', {
      conversationId,
      userId,
      readAt: new Date(),
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Đánh dấu đã đọc thành công',
      data: {
        conversationId,
      },
    };
  }
}

module.exports = ChatService;
