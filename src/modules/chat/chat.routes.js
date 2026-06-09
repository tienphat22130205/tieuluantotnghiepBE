const express = require('express');
const ChatController = require('./chat.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/conversations', ChatController.getMyConversations);
router.post('/conversations/direct', ChatController.getOrCreateDirectConversation);
router.get('/conversations/:conversationId/messages', ChatController.getConversationMessages);
router.post('/conversations/:conversationId/messages', ChatController.sendMessage);
router.patch('/conversations/:conversationId/read', ChatController.markConversationAsRead);
router.patch('/messages/:messageId/react', ChatController.toggleMessageReaction);

module.exports = router;
