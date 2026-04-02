# Friend System API Documentation

## Base URL
```
http://localhost:5000/api/friends
```

## Authentication
All friend system endpoints require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## 1. Friend Requests

### Send Friend Request
**POST** `/requests`

Send a friend request to another user.

**Request Body:**
```json
{
  "toUserId": "507f1f77bcf86cd799439011"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Lời mời kết bạn đã được gửi",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "from": {
      "_id": "507f1f77bcf86cd799439010",
      "username": "johndoe",
      "email": "john@example.com",
      "avatar": "/uploads/avatars/avatar-123.jpg",
      "firstName": "John",
      "lastName": "Doe"
    },
    "to": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "janedoe",
      "email": "jane@example.com",
      "avatar": "/uploads/avatars/avatar-124.jpg",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- 400: Lời mời kết bạn đã được gửi / Bạn đã là bạn bè
- 400: Không thể gửi lời mời kết bạn cho chính mình

---

### Get Pending Requests (Incoming)
**GET** `/requests`

Get all pending friend requests sent to the current user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "from": {
        "_id": "507f1f77bcf86cd799439010",
        "username": "johndoe",
        "email": "john@example.com",
        "avatar": "/uploads/avatars/avatar-123.jpg",
        "firstName": "John",
        "lastName": "Doe"
      },
      "to": "507f1f77bcf86cd799439011",
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Get Sent Requests (Outgoing)
**GET** `/requests/sent`

Get all pending friend requests sent by the current user (not yet accepted/declined).

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "from": "507f1f77bcf86cd799439010",
      "to": {
        "_id": "507f1f77bcf86cd799439011",
        "username": "janedoe",
        "email": "jane@example.com",
        "avatar": "/uploads/avatars/avatar-124.jpg",
        "firstName": "Jane",
        "lastName": "Doe"
      },
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Accept/Decline Friend Request
**PATCH** `/requests/:requestId`

Accept or decline a friend request.

**Request Body:**
```json
{
  "action": "accepted"
}
```

**Parameters:**
- `action`: Either `"accepted"` or `"declined"`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Lời mời kết bạn đã được chấp nhận",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "from": {...},
    "to": {...},
    "status": "accepted",
    "respondedAt": "2024-01-15T11:00:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Note:** When a request is accepted, both users are added to each other's `friends` array.

---

### Cancel Friend Request
**DELETE** `/requests/:requestId`

Cancel a friend request that you sent (must be pending).

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Lời mời kết bạn đã được hủy",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "from": "507f1f77bcf86cd799439010",
    "to": "507f1f77bcf86cd799439011",
    "status": "cancelled",
    "updatedAt": "2024-01-15T11:05:00.000Z"
  }
}
```

---

## 2. Friends List

### Get My Friends
**GET** `/`

Get all accepted friends of the current user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "janedoe",
      "email": "jane@example.com",
      "avatar": "/uploads/avatars/avatar-124.jpg",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  ],
  "count": 1
}
```

---

### Get Friends of a User
**GET** `/:userId`

Get all accepted friends of a specific user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "janedoe",
      "email": "jane@example.com",
      "avatar": "/uploads/avatars/avatar-124.jpg",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  ],
  "count": 1
}
```

---

## 3. Follow/Unfollow

### Follow a User
**POST** `/follow/:userId`

Follow a user. This is different from being friends - you can follow someone without them following you back.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Đã theo dõi thành công"
}
```

**Error Responses:**
- 400: Không thể theo dõi chính mình

---

### Unfollow a User
**DELETE** `/follow/:userId`

Stop following a user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Đã bỏ theo dõi thành công"
}
```

---

## 4. Followers/Following

### Get My Followers
**GET** `/followers/me`

Get all users who follow the current user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439010",
      "username": "johndoe",
      "email": "john@example.com",
      "avatar": "/uploads/avatars/avatar-123.jpg",
      "firstName": "John",
      "lastName": "Doe"
    }
  ],
  "count": 1
}
```

---

### Get Followers of a User
**GET** `/followers/:userId`

Get all followers of a specific user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

### Get My Following
**GET** `/following/me`

Get all users that the current user is following.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "janedoe",
      "email": "jane@example.com",
      "avatar": "/uploads/avatars/avatar-124.jpg",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  ],
  "count": 1
}
```

---

### Get Following of a User
**GET** `/following/:userId`

Get all users that a specific user is following.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [...],
  "count": 3
}
```

---

## 5. Friend Status

### Get Friend Status
**GET** `/status/:userId`

Get the relationship status between the current user and another user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "friends"
  }
}
```

**Possible Status Values:**
- `"friends"` - You are friends with this user
- `"request_sent"` - You have sent a pending friend request to this user
- `"request_received"` - This user has sent you a pending friend request
- `"following"` - You are following this user but not friends
- `"none"` - No relationship exists

---

## Friend System Permissions

### Post Visibility with Friends

Posts can have three visibility levels:

1. **public** - Visible to everyone
2. **friends** - Visible only to:
   - The post author
   - Users who are confirmed friends (via friend request)
   - Users with mutual follows (both follow each other)
3. **private** - Visible only to the post author

### Example Scenario

User A sends a friend request to User B:
- User B can see all of User A's **public** and **friends** posts marked as visible to friends

User B accepts the friend request:
- Both users can see each other's **public** and **friends** posts
- Both appear in each other's friends list

User A follows User C but User C doesn't follow User A back:
- User A cannot see User C's **friends** posts (unless they're already friends via request)
- User A can see User C's **public** posts

---

## Example API Calls with cURL

### Send Friend Request
```bash
curl -X POST http://localhost:5000/api/friends/requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "507f1f77bcf86cd799439011"
  }'
```

### Get Pending Friend Requests
```bash
curl -X GET http://localhost:5000/api/friends/requests \
  -H "Authorization: Bearer <token>"
```

### Accept Friend Request
```bash
curl -X PATCH http://localhost:5000/api/friends/requests/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "accepted"
  }'
```

### Get My Friends
```bash
curl -X GET http://localhost:5000/api/friends \
  -H "Authorization: Bearer <token>"
```

### Follow a User
```bash
curl -X POST http://localhost:5000/api/friends/follow/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>"
```

### Get Friend Status
```bash
curl -X GET http://localhost:5000/api/friends/status/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>"
```

---

## Database Schema

### FriendRequest Collection

```javascript
{
  _id: ObjectId,
  from: ObjectId (User), // User who sent the request
  to: ObjectId (User),   // User who receives the request
  status: String,        // 'pending', 'accepted', 'declined', 'cancelled'
  respondedAt: Date,     // When the request was responded to
  createdAt: Date,
  updatedAt: Date
}
```

### User Model Updates

```javascript
{
  // ... existing fields ...
  followers: [ObjectId],  // Users who follow this user
  following: [ObjectId],  // Users this user follows
  friends: [ObjectId],    // Users who are confirmed friends (via request)
  // ... other fields ...
}
```

---

## Summary: Friends vs Followers

| Relationship | Type | Definition |
|---|---|---|
| **Friends** | Bidirectional | Both users accepted a friend request - full access to friends-only content |
| **Followers** | Unidirectional | User A follows User B - basic access to public content |
| **Mutual Follow** | Bidirectional Follow | Both users follow each other - can see friends-only content based on mutual follow logic |

The friend system prioritizes explicit mutual friend requests for better permission control.
