const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['going', 'interested', 'not_going'],
      default: 'going',
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const groupEventSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Mô tả không được vượt quá 2000 ký tự'],
    },
    coverImage: {
      type: String,
      default: null,
    },
    // Sự kiện offline
    location: {
      type: String,
      default: '',
      trim: true,
    },
    // Sự kiện online
    onlineLink: {
      type: String,
      default: '',
      trim: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      default: null,
    },
    attendees: {
      type: [attendeeSchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupEvent', groupEventSchema);
