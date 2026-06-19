const mongoose = require('mongoose');
const Story = require('./story.model');
const User = require('../auth/auth.model');
const { saveFile } = require('../../utils/cloudinary');
const { HTTP_STATUS, MESSAGES } = require('../../constants');
const { emitToUser } = require('../../realtime/socket');

/**
 * Normalizes Spotify playlist/track links to an embeddable format.
 * E.g., https://open.spotify.com/playlist/3C72yAjSKqfizVmvUF0mum?si=... 
 * becomes https://open.spotify.com/embed/playlist/3C72yAjSKqfizVmvUF0mum?utm_source=generator&theme=0
 */
const getSpotifyEmbedUrl = (input) => {
  if (!input) return '';

  const trimmed = String(input).trim();
  if (trimmed.includes('spotify.com/embed/')) {
    return trimmed;
  }

  const match = trimmed.match(/spotify\.com\/(playlist|track|album)\/([a-zA-Z0-9]+)/);
  if (match) {
    const type = match[1];
    const id = match[2];
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
  }

  // Fallback: If it's a raw 22-character ID, treat it as a playlist embed
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return `https://open.spotify.com/embed/playlist/${trimmed}?utm_source=generator&theme=0`;
  }

  return trimmed;
};

class StoryService {
  static async createStory(userId, payload = {}, file = null) {
    try {
      const mediaType = payload.mediaType || 'text';
      let mediaUrl = payload.mediaUrl || '';

      if (mediaType !== 'text') {
        if (!file) {
          return {
            success: false,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Thiếu file phương tiện cho tin ảnh/video',
          };
        }
        mediaUrl = await saveFile(file, 'stories');
      }

      const spotifyUrl = getSpotifyEmbedUrl(payload.spotifyUrl);

      // Validate duration: min 5s, max 300s (5 minutes), default 5s
      const duration = Math.max(5, Math.min(Number(payload.duration) || 5, 300));

      let music = {};
      if (payload.musicTitle || payload.musicArtist) {
        music = {
          title: payload.musicTitle || '',
          artist: payload.musicArtist || '',
        };
      } else if (payload.music) {
        // Support direct music object from JSON payload
        let parsedMusic = payload.music;
        if (typeof parsedMusic === 'string') {
          try {
            parsedMusic = JSON.parse(parsedMusic);
          } catch (e) {
            // Keep as string if it fails
          }
        }
        if (typeof parsedMusic === 'object' && parsedMusic !== null) {
          music = {
            title: parsedMusic.title || '',
            artist: parsedMusic.artist || '',
          };
        }
      }

      const story = await Story.create({
        user: userId,
        mediaType,
        mediaUrl,
        textContent: payload.textContent || '',
        bgColor: payload.bgColor || '',
        textColor: payload.textColor || '',
        spotifyUrl,
        music,
        duration,
        imageFilter: payload.imageFilter || 'none',
        objectFit: ['cover', 'contain'].includes(payload.objectFit) ? payload.objectFit : 'cover',
      });

      const populated = await story.populate('user', 'username firstName lastName avatar');

      // Real-time sync socket events to user and friends
      try {
        const userObj = await User.findById(userId).select('friends');
        if (userObj) {
          const recipients = [userId, ...(userObj.friends || [])];
          recipients.forEach((recipientId) => {
            emitToUser(recipientId, 'story:created', populated);
          });
        }
      } catch (err) {
        console.error('Socket error emitting story:created:', err);
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Tạo tin thành công',
        data: populated,
      };
    } catch (error) {
      console.error('Create story service error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async getActiveStories(userId) {
    try {
      const user = await User.findById(userId).select('friends');
      if (!user) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.USER_NOT_FOUND,
        };
      }

      const friendIds = user.friends || [];
      const eligibleUserIds = [userId, ...friendIds];

      // Retrieve stories from user and friends created within the last 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const stories = await Story.find({
        user: { $in: eligibleUserIds },
        createdAt: { $gte: twentyFourHoursAgo },
        isDeleted: { $ne: true },
      })
        .populate('user', 'username firstName lastName avatar')
        .sort({ createdAt: -1 });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy danh sách tin thành công',
        data: stories,
      };
    } catch (error) {
      console.error('Get active stories service error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async getArchivedStories(userId) {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find user's own stories that are older than 24h and not deleted
      const stories = await Story.find({
        user: userId,
        createdAt: { $lt: twentyFourHoursAgo },
        isDeleted: { $ne: true },
      })
        .populate('user', 'username firstName lastName avatar')
        .sort({ createdAt: -1 });

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Lấy danh sách tin lưu trữ thành công',
        data: stories,
      };
    } catch (error) {
      console.error('Get archived stories service error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async markAsViewed(userId, storyId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Story ID không hợp lệ',
        };
      }

      const story = await Story.findOne({ _id: storyId, isDeleted: { $ne: true } });
      if (!story) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy tin',
        };
      }

      // Check if user already viewed this story
      const alreadyViewed = story.viewers.some(
        (viewer) => viewer.user.toString() === userId.toString()
      );

      if (!alreadyViewed) {
        story.viewers.push({
          user: userId,
          viewedAt: new Date(),
        });
        await story.save();
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Đã đánh dấu đã xem tin',
      };
    } catch (error) {
      console.error('Mark story as viewed service error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  static async deleteStory(userId, storyId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        return {
          success: false,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Story ID không hợp lệ',
        };
      }

      const story = await Story.findOne({ _id: storyId });
      if (!story) {
        return {
          success: false,
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy tin',
        };
      }

      if (story.user.toString() !== userId.toString()) {
        return {
          success: false,
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không có quyền xóa tin này',
        };
      }

      const storyOwnerId = story.user.toString();

      // Hard delete or set isDeleted flag (let's just hard delete as stories are short-lived)
      await story.deleteOne();

      // Real-time sync socket events to user and friends
      try {
        const userObj = await User.findById(storyOwnerId).select('friends');
        if (userObj) {
          const recipients = [storyOwnerId, ...(userObj.friends || [])];
          recipients.forEach((recipientId) => {
            emitToUser(recipientId, 'story:deleted', { storyId });
          });
        }
      } catch (err) {
        console.error('Socket error emitting story:deleted:', err);
      }

      return {
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: 'Xóa tin thành công',
      };
    } catch (error) {
      console.error('Delete story service error:', error);
      return {
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
}

module.exports = StoryService;
