const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { verifyToken } = require('../utils/jwt');
const User = require('../modules/auth/auth.model');
const ChatConversation = require('../modules/chat/chat-conversation.model');

let io;
const activeConnectionsByUser = new Map();

const getConnectionCount = (userId) => activeConnectionsByUser.get(userId) || 0;

const increaseConnection = (userId) => {
  const nextCount = getConnectionCount(userId) + 1;
  activeConnectionsByUser.set(userId, nextCount);
  return nextCount;
};

const decreaseConnection = (userId) => {
  const nextCount = Math.max(getConnectionCount(userId) - 1, 0);
  if (nextCount === 0) {
    activeConnectionsByUser.delete(userId);
  } else {
    activeConnectionsByUser.set(userId, nextCount);
  }
  return nextCount;
};

const emitPresenceUpdate = (userId, isOnline, lastSeen = null) => {
  if (!io) {
    return;
  }

  io.emit('presence:update', {
    userId,
    isOnline,
    lastSeen,
  });
};

const markUserOnline = async (userId) => {
  const user = await User.findById(userId).select('isOnline');
  if (!user) {
    return;
  }

  if (!user.isOnline) {
    user.isOnline = true;
    await user.save();
  }

  emitPresenceUpdate(userId, true, user.lastSeen || null);
};

const markUserOffline = async (userId) => {
  const lastSeen = new Date();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        isOnline: false,
        lastSeen,
      },
    }
  );

  emitPresenceUpdate(userId, false, lastSeen);
};

const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return String(authToken).replace(/^Bearer\s+/i, '').trim();
  }

  const headerToken = socket.handshake.headers?.authorization;
  if (headerToken) {
    return String(headerToken).replace(/^Bearer\s+/i, '').trim();
  }

  return null;
};

const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('UNAUTHORIZED'));
    }

    const decoded = verifyToken(token);
    if (!decoded?.id) {
      return next(new Error('UNAUTHORIZED'));
    }

    socket.user = decoded;
    return next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id.toString();
    socket.join(`user:${userId}`);

    const connectionCount = increaseConnection(userId);
    if (connectionCount === 1) {
      markUserOnline(userId).catch((error) => {
        console.error('Presence mark online error:', error);
      });
    }

    socket.on('post:join', (postId) => {
      if (!postId) {
        return;
      }
      socket.join(`post:${postId.toString()}`);
    });

    socket.on('post:leave', (postId) => {
      if (!postId) {
        return;
      }
      socket.leave(`post:${postId.toString()}`);
    });

    socket.on('chat:join', async (conversationId) => {
      if (!conversationId) {
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return;
      }

      try {
        const conversation = await ChatConversation.findOne({
          _id: conversationId,
          participants: userId,
        }).select('_id');

        if (!conversation) {
          return;
        }

        socket.join(`chat:${conversationId.toString()}`);
      } catch (error) {
        console.error('Socket chat join error:', error);
      }
    });

    socket.on('chat:leave', (conversationId) => {
      if (!conversationId) {
        return;
      }
      socket.leave(`chat:${conversationId.toString()}`);
    });

    socket.on('disconnect', () => {
      const remaining = decreaseConnection(userId);
      if (remaining === 0) {
        markUserOffline(userId).catch((error) => {
          console.error('Presence mark offline error:', error);
        });
      }
    });
  });

  return io;
};

const emitToUser = (userId, eventName, payload) => {
  if (!io || !userId) {
    return;
  }

  io.to(`user:${userId.toString()}`).emit(eventName, payload);
};

const emitToPostRoom = (postId, eventName, payload) => {
  if (!io || !postId) {
    return;
  }

  io.to(`post:${postId.toString()}`).emit(eventName, payload);
};

const emitToChatRoom = (conversationId, eventName, payload) => {
  if (!io || !conversationId) {
    return;
  }

  io.to(`chat:${conversationId.toString()}`).emit(eventName, payload);
};

module.exports = {
  initSocketServer,
  emitToUser,
  emitToPostRoom,
  emitToChatRoom,
};
