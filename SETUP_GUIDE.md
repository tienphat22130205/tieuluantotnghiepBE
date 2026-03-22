# Quick Start Guide - Backend Setup

## Prerequisites

Before you begin, make sure you have installed:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (local or MongoDB Atlas) - [Download](https://www.mongodb.com/try/download/community)
- **npm** or **yarn** (comes with Node.js)

## Installation Steps

### 1. Install Dependencies

Navigate to the backend directory and install all required packages:

```bash
cd backend
npm install
```

Or if you're using yarn:
```bash
yarn install
```

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your configuration:
   ```env
   # For local MongoDB
   MONGODB_URI=mongodb://localhost:27017/social-network

   # Or for MongoDB Atlas (cloud)
   # MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/social-network

   # Change this to a strong secret in production
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

   # Frontend URL (update if your frontend runs on a different port)
   CORS_ORIGIN=http://localhost:3000
   ```

### 3. Start MongoDB

**If using local MongoDB:**
```bash
# On Windows
mongod

# On macOS (with Homebrew)
brew services start mongodb-community

# On Linux
sudo systemctl start mongod
```

**Or use MongoDB Atlas (cloud):**
- Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Create a cluster and get your connection string
- Add it to `.env` as `MONGODB_URI`

### 4. Start the Backend Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

You should see:
```
MongoDB connected: localhost
Server running on port 5000
Environment: development
```

### 5. Test the API

#### Test Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running"
}
```

#### Test Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "phone": "0912345678",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

#### Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Project Structure Overview

```
backend/
├── src/
│   ├── config/              # Database configuration
│   │   └── database.js      # MongoDB connection
│   ├── constants/           # Global constants
│   │   ├── messages.js      # Message constants
│   │   └── http-status.js   # HTTP status codes
│   ├── middlewares/         # Express middleware
│   │   ├── auth.js          # JWT authentication
│   │   └── errorHandler.js  # Global error handler
│   ├── modules/             # Feature modules
│   │   └── auth/            # Authentication
│   │       ├── auth.model.js      # User schema
│   │       ├── auth.service.js    # Business logic
│   │       ├── auth.controller.js # Request handlers
│   │       └── auth.routes.js     # API endpoints
│   ├── routes/              # Route configuration
│   │   └── index.js         # Main router
│   ├── utils/               # Helper utilities
│   │   ├── jwt.js           # JWT token functions
│   │   ├── validation.js    # Input validation
│   │   └── response.js      # Response formatting
│   └── index.js             # Application entry point
├── .env                     # Environment variables (local)
├── .env.example             # Environment template
├── package.json             # Dependencies
└── README.md                # Documentation
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email and password
- `GET /api/auth/me` - Get current user (requires token)
- `POST /api/auth/logout` - Logout

**See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed API documentation.**

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Run tests (if configured)
npm test

# Run ESLint
npm run lint
```

## Common Issues & Solutions

### Issue: MongoDB connection error
**Solution:** Make sure MongoDB is running:
```bash
# Check if MongoDB process is running
# Windows: Check Services
# macOS: brew services list
# Linux: sudo systemctl status mongod
```

### Issue: Port 5000 already in use
**Solution:** Change the port in `.env`:
```env
PORT=5001
```

### Issue: CORS errors from frontend
**Solution:** Update `CORS_ORIGIN` in `.env` to match your frontend URL:
```env
CORS_ORIGIN=http://localhost:3000
```

### Issue: Token authentication failing
**Solution:** Make sure to:
1. Include token in Authorization header: `Bearer <token>`
2. Check that JWT_SECRET is set in `.env`
3. Verify token hasn't expired

## Next Steps

1. ✅ Backend authentication is ready
2. **Next:** Implement post, image, comment, and like modules
3. **Then:** Integrate AI service for image analysis
4. **Finally:** Test integration with your React frontend

## Connecting Frontend to Backend

In your React frontend, update API base URL:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';

// Example: Register
const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return await response.json();
};

// Example: Login
const loginUser = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  // Save token to localStorage
  if (data.success) {
    localStorage.setItem('authToken', data.data.token);
  }
  return data;
};

// Example: Get current user
const getCurrentUser = async () => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};
```

## Troubleshooting

If you encounter any issues:

1. Check the console output for error messages
2. Verify MongoDB is running and accessible
3. Check `.env` file for correct configuration
4. Make sure all dependencies are installed (`npm install`)
5. Clear node_modules and reinstall if needed:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Support

For more information:
- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT Documentation](https://jwt.io/)
