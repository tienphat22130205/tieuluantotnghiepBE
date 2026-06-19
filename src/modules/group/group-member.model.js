const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member',
    },
    // pending: đang chờ duyệt (private groups)
    // approved: thành viên chính thức
    // rejected: bị từ chối
    // banned: bị cấm
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'banned'],
      default: 'approved',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    // Ai đã xử lý request (approve/reject/ban)
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Mỗi user chỉ có một record per group
groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('GroupMember', groupMemberSchema);
