const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'unban_request',
        'unban_reviewed',
        'user_registered',
        'user_banned',
        'user_unbanned',
        'user_role_changed',
        'post_created',
        'post_deleted',
        'comment_created',
        'comment_deleted',
        'system_alert',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      avatar: { type: String, default: null },
    },
    targetId: {
      type: String,
      default: '',
    },
    targetType: {
      type: String,
      default: '',
    },
    link: {
      type: String,
      default: 'dashboard',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);

