const mongoose = require('mongoose');
const ChatConversation = require('./chat-conversation.model');
const ChatMessage = require('./chat-message.model');
const User = require('../auth/auth.model');
const { HTTP_STATUS, MESSAGES } = require('../../constants');
const { emitToChatRoom, emitToUser } = require('../../realtime/socket');

const PARTICIPANT_FIELDS = 'username firstName lastName avatar isOnline lastSeen';
const MESSAGE_SENDER_FIELDS = 'username firstName lastName avatar';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const mapConversation = (conversation, unreadCount = 0) => ({
  id: conversation._id,
  type: conversation.type,
  participants: conversation.participants,
  lastMessage: conversation.lastMessage,
  unreadCount,
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

    const unreadCount = await ChatMessage.countDocuments({
      conversation: conversation._id,
      sender: { $ne: userId },
      isDeleted: { $ne: true },
      'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy cuộc trò chuyện thành công',
      data: mapConversation(conversation, unreadCount),
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

    const mappedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await ChatMessage.countDocuments({
          conversation: conversation._id,
          sender: { $ne: userId },
          isDeleted: { $ne: true },
          'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
        });
        return mapConversation(conversation, unreadCount);
      })
    );

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách cuộc trò chuyện thành công',
      data: {
        items: mappedConversations,
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
        .populate('reactions.user', 'username firstName lastName avatar')
        .populate({
          path: 'replyTo',
          populate: {
            path: 'sender',
            select: MESSAGE_SENDER_FIELDS,
          },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const unreadCount = await ChatMessage.countDocuments({
      conversation: conversationId,
      sender: { $ne: userId },
      isDeleted: { $ne: true },
      'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy tin nhắn thành công',
      data: {
        conversation: mapConversation(conversation, unreadCount),
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

    const type = payload.type === 'sticker' ? 'sticker' : 'text';
    const sticker = payload.type === 'sticker' ? String(payload.stickerUrl || '').trim() : null;
    const content = type === 'sticker' ? '[Sticker]' : String(payload.content || '').trim();

    if (type === 'text' && !content) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Nội dung tin nhắn không được để trống',
      };
    }

    if (type === 'sticker' && !sticker) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Sticker URL không được để trống',
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

    const replyTo = payload.replyTo || null;
    if (replyTo) {
      const parentMessage = await ChatMessage.findOne({ _id: replyTo, conversation: conversationId });
      if (!parentMessage) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Tin nhắn phản hồi không tồn tại trong cuộc trò chuyện này',
        };
      }
    }

    let message = await ChatMessage.create({
      conversation: conversationId,
      sender: userId,
      content,
      type,
      sticker,
      replyTo: replyTo || null,
      storyReply: payload.storyReply || null,
      readBy: [
        {
          user: userId,
          readAt: new Date(),
        },
      ],
    });

    message = await ChatMessage.findById(message._id)
      .populate('sender', MESSAGE_SENDER_FIELDS)
      .populate('reactions.user', 'username firstName lastName avatar')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: MESSAGE_SENDER_FIELDS,
        },
      });

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

    for (const participantId of conversation.participants) {
      const participantUnreadCount = await ChatMessage.countDocuments({
        conversation: conversationId,
        sender: { $ne: participantId },
        isDeleted: { $ne: true },
        'readBy.user': { $ne: new mongoose.Types.ObjectId(participantId) },
      });

      emitToUser(participantId, 'chat:conversation:updated', {
        conversationId,
        unreadCount: participantUnreadCount,
        lastMessage: {
          content,
          sender: userId,
          createdAt: message.createdAt,
        },
      });
    }

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

  static async toggleMessageReaction(userId, messageId, reactionType) {
    if (!isValidObjectId(userId) || !isValidObjectId(messageId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID hoặc Message ID không hợp lệ',
      };
    }

    if (!reactionType) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Loại cảm xúc không được để trống',
      };
    }

    const message = await ChatMessage.findOne({ _id: messageId, isDeleted: { $ne: true } });
    if (!message) {
      return {
        success: false,
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy tin nhắn',
      };
    }

    // Verify user is a participant of the conversation
    const conversation = await ChatConversation.findOne({
      _id: message.conversation,
      participants: userId,
    }).select('_id');

    if (!conversation) {
      return {
        success: false,
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Bạn không có quyền tương tác với tin nhắn này',
      };
    }

    // Check if user already reacted
    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString()
    );

    if (existingIndex > -1) {
      const existingReaction = message.reactions[existingIndex];
      if (existingReaction.type === reactionType) {
        // Toggle OFF if same reaction clicked
        message.reactions.splice(existingIndex, 1);
      } else {
        // Change reaction type if different reaction clicked
        message.reactions[existingIndex].type = reactionType;
      }
    } else {
      // Add new reaction
      message.reactions.push({
        user: userId,
        type: reactionType,
      });
    }

    await message.save();

    // Populate reactions.user details
    const updatedMessage = await ChatMessage.findById(messageId)
      .populate('reactions.user', 'username firstName lastName avatar')
      .select('reactions conversation');

    // Emit real-time event to conversation room
    emitToChatRoom(message.conversation.toString(), 'chat:message:reaction:updated', {
      messageId: message._id,
      conversationId: message.conversation,
      reactions: updatedMessage.reactions,
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Cập nhật cảm xúc thành công',
      data: updatedMessage.reactions,
    };
  }

  static async searchConversationMessages(userId, conversationId, q, query = {}) {
    if (!isValidObjectId(userId) || !isValidObjectId(conversationId)) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'User ID hoặc Conversation ID không hợp lệ',
      };
    }

    if (!q || !String(q).trim()) {
      return {
        success: false,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Từ khóa tìm kiếm không được để trống',
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

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
    const searchRegex = new RegExp(String(q).trim(), 'i');

    const filter = {
      conversation: conversationId,
      content: { $regex: searchRegex },
      isDeleted: { $ne: true },
    };

    const [total, messages] = await Promise.all([
      ChatMessage.countDocuments(filter),
      ChatMessage.find(filter)
        .populate('sender', MESSAGE_SENDER_FIELDS)
        .populate('reactions.user', 'username firstName lastName avatar')
        .populate({
          path: 'replyTo',
          populate: {
            path: 'sender',
            select: MESSAGE_SENDER_FIELDS,
          },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Tìm kiếm tin nhắn thành công',
      data: {
        items: messages,
        meta: {
          page,
          limit,
          total,
          hasMore: page * limit < total,
        },
      },
    };
  }
}

module.exports = ChatService;
