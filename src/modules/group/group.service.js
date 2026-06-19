const mongoose = require('mongoose');
const Group = require('./group.model');
const GroupMember = require('./group-member.model');
const GroupPost = require('./group-post.model');
const GroupMessage = require('./group-message.model');
const GroupPoll = require('./group-poll.model');
const GroupEvent = require('./group-event.model');
const NotificationService = require('../notification/notification.service');
const { HTTP_STATUS } = require('../../constants');
const { saveFile } = require('../../utils/cloudinary');
const {
  emitToUser,
  emitToGroupRoom,
} = require('../../realtime/socket');

// ─────────────────── Helpers ───────────────────

const normalizeHashtags = (hashtags) => {
  if (!hashtags) return [];
  let list = hashtags;
  if (typeof hashtags === 'string') {
    try {
      const parsed = JSON.parse(hashtags);
      list = Array.isArray(parsed) ? parsed : hashtags.split(',');
    } catch {
      list = hashtags.split(',');
    }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(
    list.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
  )].slice(0, 20);
};

const isGroupAdmin = (membership) =>
  membership && membership.status === 'approved' && ['admin', 'moderator'].includes(membership.role);

const isSuperAdmin = (membership) =>
  membership && membership.status === 'approved' && membership.role === 'admin';

const MEMBER_POPULATE = {
  path: 'user',
  select: 'username firstName lastName avatar isOnline',
};

// ═══════════════════════════════════════════════
//  GROUP CRUD
// ═══════════════════════════════════════════════

class GroupService {

  // ── Tạo nhóm ──
  static async createGroup(creatorId, body, files) {
    const { name, description, privacy } = body;

    if (!name || !name.trim()) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Tên nhóm là bắt buộc' };
    }

    let coverImageUrl = null;
    let avatarUrl = null;

    if (files?.coverImage?.[0]) {
      coverImageUrl = await saveFile(files.coverImage[0], 'group-covers');
    }
    if (files?.avatar?.[0]) {
      avatarUrl = await saveFile(files.avatar[0], 'group-avatars');
    }

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() || '',
      privacy: privacy === 'private' ? 'private' : 'public',
      creator: creatorId,
      coverImage: coverImageUrl,
      avatar: avatarUrl,
    });

    // Creator tự động trở thành admin
    await GroupMember.create({
      group: group._id,
      user: creatorId,
      role: 'admin',
      status: 'approved',
      joinedAt: new Date(),
    });

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Tạo nhóm thành công',
      data: group,
    };
  }

  // ── Lấy thông tin nhóm ──
  static async getGroupById(groupId, requesterId) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Group ID không hợp lệ' };
    }

    const group = await Group.findOne({ _id: groupId, isDeleted: { $ne: true } })
      .populate('creator', 'username firstName lastName avatar');

    if (!group) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy nhóm' };
    }

    // Lấy membership của requester
    const membership = requesterId
      ? await GroupMember.findOne({ group: groupId, user: requesterId })
      : null;

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy thông tin nhóm thành công',
      data: {
        ...group.toObject(),
        myMembership: membership
          ? { role: membership.role, status: membership.status }
          : null,
      },
    };
  }

  // ── Tìm kiếm nhóm ──
  static async searchGroups(query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
    const keyword = String(query.q || '').trim();

    const filter = { isDeleted: { $ne: true } };
    if (keyword) {
      filter.$text = { $search: keyword };
    }

    const [total, items] = await Promise.all([
      Group.countDocuments(filter),
      Group.find(filter)
        .populate('creator', 'username firstName lastName avatar')
        .sort({ memberCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Tìm kiếm nhóm thành công',
      data: { items, meta: { page, limit, total, hasMore: page * limit < total } },
    };
  }

  // ── Nhóm của tôi ──
  static async getMyGroups(userId, query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);

    const memberships = await GroupMember.find({
      user: userId,
      status: 'approved',
    })
      .sort({ joinedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'group',
        match: { isDeleted: { $ne: true } },
        populate: { path: 'creator', select: 'username firstName lastName avatar' },
      });

    const items = memberships
      .filter((m) => m.group)
      .map((m) => ({
        ...m.group.toObject(),
        myRole: m.role,
      }));

    const total = await GroupMember.countDocuments({ user: userId, status: 'approved' });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách nhóm thành công',
      data: { items, meta: { page, limit, total, hasMore: page * limit < total } },
    };
  }

  // ── Cập nhật nhóm ──
  static async updateGroup(groupId, adminId, body, files) {
    const membership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isSuperAdmin(membership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin mới được chỉnh sửa nhóm' };
    }

    const group = await Group.findOne({ _id: groupId, isDeleted: { $ne: true } });
    if (!group) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy nhóm' };
    }

    const updates = {};
    if (body.name) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.privacy === 'public' || body.privacy === 'private') updates.privacy = body.privacy;

    if (files?.coverImage?.[0]) {
      updates.coverImage = await saveFile(files.coverImage[0], 'group-covers');
    }
    if (files?.avatar?.[0]) {
      updates.avatar = await saveFile(files.avatar[0], 'group-avatars');
    }

    const updated = await Group.findByIdAndUpdate(groupId, { $set: updates }, { new: true });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Cập nhật nhóm thành công',
      data: updated,
    };
  }

  // ── Xóa nhóm (chỉ creator) ──
  static async deleteGroup(groupId, userId) {
    const group = await Group.findOne({ _id: groupId, isDeleted: { $ne: true } });
    if (!group) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy nhóm' };
    }
    if (group.creator.toString() !== userId.toString()) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ người tạo nhóm mới được xóa nhóm' };
    }

    await Group.findByIdAndUpdate(groupId, { isDeleted: true, deletedAt: new Date() });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Xóa nhóm thành công',
    };
  }

  // ═══════════════════════════════════════════════
  //  MEMBERSHIP
  // ═══════════════════════════════════════════════

  // ── Tham gia nhóm ──
  static async joinGroup(groupId, userId) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Group ID không hợp lệ' };
    }

    const group = await Group.findOne({ _id: groupId, isDeleted: { $ne: true } });
    if (!group) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy nhóm' };
    }

    // Kiểm tra đã tham gia hay chưa
    const existing = await GroupMember.findOne({ group: groupId, user: userId });
    if (existing) {
      if (existing.status === 'approved') {
        return { success: false, statusCode: HTTP_STATUS.CONFLICT, message: 'Bạn đã là thành viên của nhóm này' };
      }
      if (existing.status === 'pending') {
        return { success: false, statusCode: HTTP_STATUS.CONFLICT, message: 'Yêu cầu tham gia đang được xem xét' };
      }
      if (existing.status === 'banned') {
        return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn đã bị cấm khỏi nhóm này' };
      }
      // Rejected → cho phép gửi lại
      await GroupMember.findByIdAndUpdate(existing._id, {
        status: group.privacy === 'private' ? 'pending' : 'approved',
        requestedAt: new Date(),
        joinedAt: group.privacy === 'public' ? new Date() : null,
      });
    } else {
      const status = group.privacy === 'private' ? 'pending' : 'approved';
      await GroupMember.create({
        group: groupId,
        user: userId,
        role: 'member',
        status,
        requestedAt: new Date(),
        joinedAt: status === 'approved' ? new Date() : null,
      });

      if (status === 'approved') {
        await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } });
        emitToGroupRoom(groupId, 'group:member-joined', { groupId, userId });
      }
    }

    // Notify admin nếu private
    if (group.privacy === 'private') {
      const admins = await GroupMember.find({ group: groupId, role: { $in: ['admin', 'moderator'] }, status: 'approved' });
      for (const admin of admins) {
        if (admin.user.toString() !== userId.toString()) {
          await NotificationService.createNotification({
            recipient: admin.user,
            actor: userId,
            type: 'group_join_request',
            metadata: { groupId, groupName: group.name },
          });
          emitToUser(admin.user, 'group:member-request', { groupId, userId, groupName: group.name });
        }
      }
    }

    const message = group.privacy === 'private'
      ? 'Yêu cầu tham gia nhóm đã được gửi, chờ admin duyệt'
      : 'Tham gia nhóm thành công';

    return { success: true, statusCode: HTTP_STATUS.OK, message };
  }

  // ── Rời nhóm ──
  static async leaveGroup(groupId, userId) {
    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Bạn không phải thành viên của nhóm này' };
    }

    const group = await Group.findById(groupId);
    if (group?.creator.toString() === userId.toString()) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Người tạo nhóm không thể rời nhóm. Hãy chuyển quyền admin trước.' };
    }

    await GroupMember.findByIdAndDelete(membership._id);
    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } });

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Rời nhóm thành công' };
  }

  // ── Danh sách thành viên ──
  static async getMembers(groupId, query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);

    const filter = { group: groupId, status: 'approved' };

    const [total, items] = await Promise.all([
      GroupMember.countDocuments(filter),
      GroupMember.find(filter)
        .populate(MEMBER_POPULATE)
        .sort({ role: 1, joinedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách thành viên thành công',
      data: { items, meta: { page, limit, total, hasMore: page * limit < total } },
    };
  }

  // ── Danh sách chờ duyệt ──
  static async getPendingMembers(groupId, adminId) {
    const membership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isGroupAdmin(membership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin/moderator mới xem được danh sách chờ duyệt' };
    }

    const items = await GroupMember.find({ group: groupId, status: 'pending' })
      .populate(MEMBER_POPULATE)
      .sort({ requestedAt: 1 });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách chờ duyệt thành công',
      data: items,
    };
  }

  // ── Duyệt thành viên ──
  static async approveMember(groupId, adminId, targetUserId) {
    const adminMembership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isGroupAdmin(adminMembership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin/moderator mới duyệt được thành viên' };
    }

    const membership = await GroupMember.findOneAndUpdate(
      { group: groupId, user: targetUserId, status: 'pending' },
      {
        $set: {
          status: 'approved',
          joinedAt: new Date(),
          processedBy: adminId,
          processedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy yêu cầu tham gia' };
    }

    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } });

    const group = await Group.findById(groupId).select('name');
    await NotificationService.createNotification({
      recipient: targetUserId,
      actor: adminId,
      type: 'group_request_approved',
      metadata: { groupId, groupName: group?.name },
    });
    emitToUser(targetUserId, 'group:request-approved', { groupId, groupName: group?.name });
    emitToGroupRoom(groupId, 'group:member-joined', { groupId, userId: targetUserId });

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Duyệt thành viên thành công' };
  }

  // ── Từ chối thành viên ──
  static async rejectMember(groupId, adminId, targetUserId) {
    const adminMembership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isGroupAdmin(adminMembership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin/moderator mới từ chối được thành viên' };
    }

    const membership = await GroupMember.findOneAndUpdate(
      { group: groupId, user: targetUserId, status: 'pending' },
      { $set: { status: 'rejected', processedBy: adminId, processedAt: new Date() } },
      { new: true }
    );

    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy yêu cầu tham gia' };
    }

    const group = await Group.findById(groupId).select('name');
    emitToUser(targetUserId, 'group:request-rejected', { groupId, groupName: group?.name });

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Từ chối yêu cầu thành công' };
  }

  // ── Cấm thành viên ──
  static async banMember(groupId, adminId, targetUserId) {
    if (targetUserId.toString() === adminId.toString()) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Không thể cấm chính mình' };
    }

    const adminMembership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isSuperAdmin(adminMembership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin mới cấm được thành viên' };
    }

    const targetMembership = await GroupMember.findOne({ group: groupId, user: targetUserId });
    if (!targetMembership) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy thành viên' };
    }
    if (targetMembership.role === 'admin') {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Không thể cấm admin khác' };
    }

    const wasApproved = targetMembership.status === 'approved';
    await GroupMember.findByIdAndUpdate(targetMembership._id, {
      $set: { status: 'banned', processedBy: adminId, processedAt: new Date() },
    });

    if (wasApproved) {
      await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } });
    }

    const group = await Group.findById(groupId).select('name');
    emitToUser(targetUserId, 'group:member-banned', { groupId, groupName: group?.name });

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Đã cấm thành viên khỏi nhóm' };
  }

  // ── Promote/Demote ──
  static async promoteMember(groupId, adminId, targetUserId) {
    const adminMembership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isSuperAdmin(adminMembership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin mới trao quyền được' };
    }

    const updated = await GroupMember.findOneAndUpdate(
      { group: groupId, user: targetUserId, status: 'approved', role: 'member' },
      { $set: { role: 'moderator' } },
      { new: true }
    );

    if (!updated) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy thành viên hoặc thành viên đã là moderator/admin' };
    }

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Trao quyền moderator thành công' };
  }

  static async demoteMember(groupId, adminId, targetUserId) {
    const adminMembership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isSuperAdmin(adminMembership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin mới thu hồi quyền được' };
    }

    const updated = await GroupMember.findOneAndUpdate(
      { group: groupId, user: targetUserId, status: 'approved', role: 'moderator' },
      { $set: { role: 'member' } },
      { new: true }
    );

    if (!updated) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy moderator này' };
    }

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Thu hồi quyền moderator thành công' };
  }

  // ══════════════════════════════════════════════
  //  GROUP POSTS
  // ══════════════════════════════════════════════

  // ── Đăng bài trong nhóm ──
  static async createGroupPost(groupId, authorId, body, files) {
    const membership = await GroupMember.findOne({ group: groupId, user: authorId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm để đăng bài' };
    }

    const { content, hashtags } = body;
    if (!content?.trim() && (!files || !files.images?.length)) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Bài viết phải có nội dung hoặc ảnh' };
    }

    let imageUrls = [];
    if (files?.images?.length) {
      imageUrls = await Promise.all(
        files.images.map((f) => saveFile(f, 'group-posts'))
      );
    }

    const post = await GroupPost.create({
      group: groupId,
      author: authorId,
      content: content?.trim() || '',
      images: imageUrls,
      hashtags: normalizeHashtags(hashtags),
    });

    await Group.findByIdAndUpdate(groupId, { $inc: { postCount: 1 } });

    const populated = await GroupPost.findById(post._id)
      .populate('author', 'username firstName lastName avatar');

    // Notify all members realtime
    emitToGroupRoom(groupId, 'group:new-post', { groupId, post: populated });

    // Notify group members (không notify chính tác giả)
    const members = await GroupMember.find({ group: groupId, status: 'approved', user: { $ne: authorId } }).select('user').lean();
    for (const m of members) {
      await NotificationService.createNotification({
        recipient: m.user,
        actor: authorId,
        type: 'group_new_post',
        metadata: { groupId, postId: post._id },
      });
    }

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Đăng bài thành công',
      data: populated,
    };
  }

  // ── Lấy bài viết nhóm ──
  static async getGroupPosts(groupId, requesterId, query = {}) {
    const membership = await GroupMember.findOne({ group: groupId, user: requesterId, status: 'approved' });
    if (!membership) {
      // Public group: cho xem feed không cần là thành viên
      const group = await Group.findOne({ _id: groupId, isDeleted: { $ne: true } });
      if (!group || group.privacy === 'private') {
        return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm để xem bài viết' };
      }
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
    const filter = { group: groupId, isDeleted: { $ne: true } };

    const [total, items] = await Promise.all([
      GroupPost.countDocuments(filter),
      GroupPost.find(filter)
        .populate('author', 'username firstName lastName avatar')
        .populate('comments.user', 'username firstName lastName avatar')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy bài viết nhóm thành công',
      data: { items, meta: { page, limit, total, hasMore: page * limit < total } },
    };
  }

  // ── Xóa bài viết nhóm ──
  static async deleteGroupPost(groupId, postId, userId) {
    const post = await GroupPost.findOne({ _id: postId, group: groupId, isDeleted: { $ne: true } });
    if (!post) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy bài viết' };
    }

    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    const isAuthor = post.author.toString() === userId.toString();
    const isAdmin = isGroupAdmin(membership);

    if (!isAuthor && !isAdmin) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Không có quyền xóa bài viết này' };
    }

    await GroupPost.findByIdAndUpdate(postId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    });
    await Group.findByIdAndUpdate(groupId, { $inc: { postCount: -1 } });

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Xóa bài viết thành công' };
  }

  // ── Ghim bài viết ──
  static async pinGroupPost(groupId, postId, adminId) {
    const membership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isGroupAdmin(membership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin/moderator mới ghim bài được' };
    }

    const post = await GroupPost.findOne({ _id: postId, group: groupId, isDeleted: { $ne: true } });
    if (!post) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy bài viết' };
    }

    const newPinned = !post.isPinned;
    await GroupPost.findByIdAndUpdate(postId, { isPinned: newPinned });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: newPinned ? 'Đã ghim bài viết' : 'Đã bỏ ghim bài viết',
      data: { isPinned: newPinned },
    };
  }

  // ── Like bài viết nhóm ──
  static async likeGroupPost(groupId, postId, userId) {
    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const post = await GroupPost.findOneAndUpdate(
      { _id: postId, group: groupId, isDeleted: { $ne: true }, likes: { $ne: userId } },
      { $addToSet: { likes: userId } },
      { new: true }
    );

    if (!post) {
      return { success: false, statusCode: HTTP_STATUS.CONFLICT, message: 'Bạn đã thích bài viết này' };
    }

    emitToGroupRoom(groupId, 'group:post-liked', { groupId, postId, userId, likesCount: post.likes.length });

    if (post.author.toString() !== userId.toString()) {
      await NotificationService.createNotification({
        recipient: post.author,
        actor: userId,
        type: 'group_post_liked',
        metadata: { groupId, postId },
      });
    }

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Đã thích bài viết',
      data: { likesCount: post.likes.length },
    };
  }

  // ── Unlike ──
  static async unlikeGroupPost(groupId, postId, userId) {
    const post = await GroupPost.findOneAndUpdate(
      { _id: postId, group: groupId, isDeleted: { $ne: true } },
      { $pull: { likes: userId } },
      { new: true }
    );

    if (!post) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy bài viết' };
    }

    emitToGroupRoom(groupId, 'group:post-unliked', { groupId, postId, userId, likesCount: post.likes.length });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Đã bỏ thích',
      data: { likesCount: post.likes.length },
    };
  }

  // ── Comment bài viết nhóm ──
  static async addGroupComment(groupId, postId, userId, content) {
    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    if (!content?.trim()) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Nội dung bình luận không được rỗng' };
    }

    const comment = { user: userId, content: content.trim(), createdAt: new Date() };
    const post = await GroupPost.findOneAndUpdate(
      { _id: postId, group: groupId, isDeleted: { $ne: true } },
      { $push: { comments: comment } },
      { new: true }
    ).populate('comments.user', 'username firstName lastName avatar');

    if (!post) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy bài viết' };
    }

    const newComment = post.comments[post.comments.length - 1];
    emitToGroupRoom(groupId, 'group:post-commented', { groupId, postId, comment: newComment });

    if (post.author.toString() !== userId.toString()) {
      await NotificationService.createNotification({
        recipient: post.author,
        actor: userId,
        type: 'group_post_commented',
        metadata: { groupId, postId },
      });
    }

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Bình luận thành công',
      data: newComment,
    };
  }

  // ── Xóa comment ──
  static async deleteGroupComment(groupId, postId, commentId, userId) {
    const post = await GroupPost.findOne({ _id: postId, group: groupId, isDeleted: { $ne: true } });
    if (!post) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy bài viết' };
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy bình luận' };
    }

    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    const isOwner = comment.user.toString() === userId.toString();
    const isAdmin = isGroupAdmin(membership);

    if (!isOwner && !isAdmin) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Không có quyền xóa bình luận này' };
    }

    await GroupPost.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } } });

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Xóa bình luận thành công' };
  }

  // ══════════════════════════════════════════════
  //  GROUP CHAT
  // ══════════════════════════════════════════════

  static async getGroupMessages(groupId, requesterId, query = {}) {
    const membership = await GroupMember.findOne({ group: groupId, user: requesterId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);

    const [total, items] = await Promise.all([
      GroupMessage.countDocuments({ group: groupId, isDeleted: { $ne: true } }),
      GroupMessage.find({ group: groupId, isDeleted: { $ne: true } })
        .populate('sender', 'username firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy tin nhắn nhóm thành công',
      data: { items: items.reverse(), meta: { page, limit, total, hasMore: page * limit < total } },
    };
  }

  static async sendGroupMessage(groupId, senderId, body) {
    const membership = await GroupMember.findOne({ group: groupId, user: senderId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const { content } = body;
    if (!content?.trim()) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Nội dung tin nhắn không được rỗng' };
    }

    const message = await GroupMessage.create({
      group: groupId,
      sender: senderId,
      content: content.trim(),
      type: 'text',
      readBy: [senderId],
    });

    const populated = await GroupMessage.findById(message._id)
      .populate('sender', 'username firstName lastName avatar');

    emitToGroupRoom(groupId, 'group:new-message', { groupId, message: populated });

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Gửi tin nhắn thành công',
      data: populated,
    };
  }

  // ══════════════════════════════════════════════
  //  POLLS
  // ══════════════════════════════════════════════

  static async createPoll(groupId, authorId, body) {
    const membership = await GroupMember.findOne({ group: groupId, user: authorId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const { question, options, allowMultiple, expiresAt } = body;

    if (!question?.trim()) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Câu hỏi là bắt buộc' };
    }

    if (!Array.isArray(options) || options.length < 2) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Poll cần ít nhất 2 lựa chọn' };
    }

    if (options.length > 10) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Poll tối đa 10 lựa chọn' };
    }

    const poll = await GroupPoll.create({
      group: groupId,
      author: authorId,
      question: question.trim(),
      options: options.map((o) => ({ text: String(o).trim(), voters: [] })),
      allowMultiple: Boolean(allowMultiple),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    emitToGroupRoom(groupId, 'group:new-poll', { groupId, poll });

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Tạo poll thành công',
      data: poll,
    };
  }

  static async getGroupPolls(groupId, requesterId) {
    const membership = await GroupMember.findOne({ group: groupId, user: requesterId, status: 'approved' });
    if (!membership) {
      const group = await Group.findOne({ _id: groupId, privacy: 'public', isDeleted: { $ne: true } });
      if (!group) return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const polls = await GroupPoll.find({ group: groupId, isDeleted: { $ne: true } })
      .populate('author', 'username firstName lastName avatar')
      .sort({ createdAt: -1 });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách poll thành công',
      data: polls,
    };
  }

  static async votePoll(groupId, pollId, userId, optionIds) {
    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const poll = await GroupPoll.findOne({ _id: pollId, group: groupId, isDeleted: { $ne: true } });
    if (!poll) return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy poll' };
    if (poll.isClosed) return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Poll đã đóng' };
    if (poll.expiresAt && new Date() > poll.expiresAt) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Poll đã hết hạn' };
    }

    // Xóa vote cũ của user khỏi tất cả options
    poll.options.forEach((opt) => {
      opt.voters = opt.voters.filter((v) => v.toString() !== userId.toString());
    });

    // Thêm vote mới
    const ids = Array.isArray(optionIds) ? optionIds : [optionIds];
    const toVote = poll.allowMultiple ? ids : [ids[0]];

    toVote.forEach((optId) => {
      const opt = poll.options.id(optId);
      if (opt && !opt.voters.map((v) => v.toString()).includes(userId.toString())) {
        opt.voters.push(userId);
      }
    });

    await poll.save();

    emitToGroupRoom(groupId, 'group:poll-voted', { groupId, pollId, poll });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Vote thành công',
      data: poll,
    };
  }

  static async closePoll(groupId, pollId, adminId) {
    const membership = await GroupMember.findOne({ group: groupId, user: adminId, status: 'approved' });
    if (!isGroupAdmin(membership)) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Chỉ admin/moderator mới đóng poll được' };
    }

    const poll = await GroupPoll.findOneAndUpdate(
      { _id: pollId, group: groupId },
      { isClosed: true },
      { new: true }
    );

    if (!poll) return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy poll' };

    return { success: true, statusCode: HTTP_STATUS.OK, message: 'Đóng poll thành công', data: poll };
  }

  // ══════════════════════════════════════════════
  //  EVENTS
  // ══════════════════════════════════════════════

  static async createEvent(groupId, authorId, body, files) {
    const membership = await GroupMember.findOne({ group: groupId, user: authorId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const { title, description, location, onlineLink, startAt, endAt } = body;

    if (!title?.trim()) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Tiêu đề sự kiện là bắt buộc' };
    }

    if (!startAt) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Thời gian bắt đầu là bắt buộc' };
    }

    let coverImageUrl = null;
    if (files?.coverImage?.[0]) {
      coverImageUrl = await saveFile(files.coverImage[0], 'group-events');
    }

    const event = await GroupEvent.create({
      group: groupId,
      author: authorId,
      title: title.trim(),
      description: description?.trim() || '',
      coverImage: coverImageUrl,
      location: location?.trim() || '',
      onlineLink: onlineLink?.trim() || '',
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      attendees: [{ user: authorId, status: 'going', respondedAt: new Date() }],
    });

    emitToGroupRoom(groupId, 'group:new-event', { groupId, event });

    return {
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      message: 'Tạo sự kiện thành công',
      data: event,
    };
  }

  static async getGroupEvents(groupId, requesterId) {
    const membership = await GroupMember.findOne({ group: groupId, user: requesterId, status: 'approved' });
    if (!membership) {
      const group = await Group.findOne({ _id: groupId, privacy: 'public', isDeleted: { $ne: true } });
      if (!group) return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const events = await GroupEvent.find({ group: groupId, isDeleted: { $ne: true } })
      .populate('author', 'username firstName lastName avatar')
      .sort({ startAt: 1 });

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Lấy danh sách sự kiện thành công',
      data: events,
    };
  }

  static async respondToEvent(groupId, eventId, userId, status) {
    const membership = await GroupMember.findOne({ group: groupId, user: userId, status: 'approved' });
    if (!membership) {
      return { success: false, statusCode: HTTP_STATUS.FORBIDDEN, message: 'Bạn phải là thành viên nhóm' };
    }

    const validStatuses = ['going', 'interested', 'not_going'];
    if (!validStatuses.includes(status)) {
      return { success: false, statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Trạng thái không hợp lệ (going/interested/not_going)' };
    }

    const event = await GroupEvent.findOne({ _id: eventId, group: groupId, isDeleted: { $ne: true } });
    if (!event) return { success: false, statusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy sự kiện' };

    const existing = event.attendees.find((a) => a.user.toString() === userId.toString());
    if (existing) {
      existing.status = status;
      existing.respondedAt = new Date();
    } else {
      event.attendees.push({ user: userId, status, respondedAt: new Date() });
    }

    await event.save();

    return {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Phản hồi sự kiện thành công',
      data: { eventId, status },
    };
  }
}

module.exports = GroupService;
