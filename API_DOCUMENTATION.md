# API Documentation - Authentication

## Base URL
```
http://localhost:5000/api
```

## Authentication Endpoints

### 1. Register (Đăng ký)
**POST** `/auth/register`

Register a new user account with username, email, phone, and password.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "phone": "0912345678",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": "0912345678",
      "firstName": "",
      "lastName": "",
      "avatar": null,
      "bio": "",
      "isActive": true,
      "followers": [],
      "following": [],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response Examples:**

Missing fields (400):
```json
{
  "success": false,
  "message": "Vui lòng điền đầy đủ thông tin",
  "data": null,
  "error": null
}
```

Email already exists (409):
```json
{
  "success": false,
  "message": "Email đã được sử dụng",
  "data": null,
  "error": null
}
```

Invalid phone (400):
```json
{
  "success": false,
  "message": "Vui lòng cung cấp số điện thoại hợp lệ (10 chữ số, bắt đầu bằng 0)",
  "data": null,
  "error": null
}
```

### 2. Login (Đăng nhập)
**POST** `/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": "0912345678",
      "firstName": "",
      "lastName": "",
      "avatar": null,
      "bio": "",
      "isActive": true,
      "followers": [],
      "following": [],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không chính xác",
  "data": null,
  "error": null
}
```

### 3. Get Current User (Lấy thông tin người dùng hiện tại)
**GET** `/auth/me`

Get the current authenticated user's information.

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy thông tin người dùng thành công",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "phone": "0912345678",
    "firstName": "",
    "lastName": "",
    "avatar": null,
    "bio": "",
    "isActive": true,
    "followers": [],
    "following": [],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Token là bắt buộc",
  "data": null,
  "error": null
}
```

### 4. Logout (Đăng xuất)
**POST** `/auth/logout`

Logout the current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null
}
```

## Validation Rules

### Username
- Length: 3-20 characters
- Only alphanumeric characters and underscores
- Example: `john_doe123`

### Email
- Must be a valid email format
- Example: `john@example.com`

### Phone
- Must be 10 digits
- Must start with 0
- Vietnamese phone format
- Example: `0912345678`

### Password
- Minimum 6 characters
- No specific complexity requirements
- Example: `password123`

## Security Notes

1. **JWT Token Format:**
   - Token is sent in response after successful registration/login
   - Token includes user ID and email
   - Token expires in 7 days (configurable via JWT_EXPIRE in .env)

2. **Password Security:**
   - Passwords are hashed using bcrypt (10 salt rounds)
   - Password is never returned in responses (except during input)
   - Use `select('+password')` only when needed

3. **Authentication:**
   - Include token in Authorization header as `Bearer <token>`
   - Most endpoints will require this authentication

## Error Codes Reference

| HTTP Status | Meaning |
|------------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Missing or invalid authentication |
| 409 | Conflict - Resource already exists (duplicate email/phone/username) |
| 500 | Internal Server Error |

## Usage Examples

### Register with cURL
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "phone": "0912345678",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

### Login with cURL
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Current User with cURL
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <your_token_here>"
```

### Using JavaScript/Fetch API

**Register:**
```javascript
fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'johndoe',
    email: 'john@example.com',
    phone: '0912345678',
    password: 'password123',
    confirmPassword: 'password123'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

**Login:**
```javascript
fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'password123'
  })
})
.then(response => response.json())
.then(data => {
  // Save token to localStorage
  localStorage.setItem('authToken', data.data.token);
  console.log(data);
});
```

**Get Current User:**
```javascript
const token = localStorage.getItem('authToken');

fetch('http://localhost:5000/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => console.log(data));
```
