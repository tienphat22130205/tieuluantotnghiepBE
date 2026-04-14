const Post = require('../modules/post/post.model');
const Notification = require('../modules/notification/notification.model');

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_JOB_INTERVAL_MS = 12 * 60 * 60 * 1000;

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getRetentionDays = () => parsePositiveNumber(process.env.SOFT_DELETE_RETENTION_DAYS, DEFAULT_RETENTION_DAYS);

const getJobIntervalMs = () => parsePositiveNumber(process.env.SOFT_DELETE_CLEANUP_INTERVAL_MS, DEFAULT_JOB_INTERVAL_MS);

const getCutoffDate = () => {
  const retentionDays = getRetentionDays();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  return cutoffDate;
};

const cleanupSoftDeletedData = async () => {
  const cutoffDate = getCutoffDate();

  const [postResult, notificationResult] = await Promise.all([
    Post.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoffDate },
    }),
    Notification.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoffDate },
    }),
  ]);

  return {
    deletedPosts: postResult.deletedCount || 0,
    deletedNotifications: notificationResult.deletedCount || 0,
    cutoffDate,
  };
};

const startRetentionCleanupJob = () => {
  const runCleanup = async () => {
    try {
      const result = await cleanupSoftDeletedData();
      console.log(
        `[cleanup] Removed ${result.deletedPosts} posts and ${result.deletedNotifications} notifications soft-deleted before ${result.cutoffDate.toISOString()}`
      );
    } catch (error) {
      console.error('[cleanup] Cleanup job failed:', error);
    }
  };

  runCleanup();

  const intervalId = setInterval(runCleanup, getJobIntervalMs());
  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }

  return intervalId;
};

module.exports = {
  cleanupSoftDeletedData,
  startRetentionCleanupJob,
};
