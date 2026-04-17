const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct'],
      default: 'direct',
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      content: {
        type: String,
        default: '',
        trim: true,
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      createdAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

chatConversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
