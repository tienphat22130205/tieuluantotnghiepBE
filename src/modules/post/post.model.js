const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    hashtags: [
      {
        type: String,
        trim: true,
      },
    ],
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    postType: {
      type: String,
      enum: ['image', 'avatar_update', 'status'],
      default: 'image',
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        content: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Post', postSchema);
