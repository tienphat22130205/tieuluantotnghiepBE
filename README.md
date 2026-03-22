# Social Network Backend

A minimal, clean, and maintainable backend for a social networking platform built with Node.js, Express.js, and MongoDB.

## Features

- User authentication (Register, Login)
- User profiles and management
- Image upload and management
- Post creation and sharing
- Comments on posts
- Like functionality
- User follow system
- AI-powered image analysis (generate captions, descriptions, hashtags)
- RESTful API design
- JWT authentication
- Input validation
- Error handling middleware

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer
- **Validation**: express-validator
- **AI Integration**: Configurable AI service API

## Project Structure

```
backend/
│
├── src/
│   ├── config/          # MongoDB connection and environment config
│   ├── modules/         # Feature modules
│   │   ├── auth/        # Authentication
│   │   ├── user/        # User management
│   │   ├── post/        # Post management
│   │   ├── comment/     # Comments
│   │   ├── like/        # Likes
│   │   ├── image/       # Image handling
│   │   └── ai/          # AI services
│   ├── middlewares/     # Authentication, error handling, etc
│   ├── routes/          # Route loaders and configurations
│   ├── utils/           # Helper functions
│   └── constants/       # Global constants
│
├── uploads/             # Uploaded files (images, videos...)
├── logs/                # Application logs
├── tests/               # Testing files
├── .env                 # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values with your configuration

3. Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## Module Structure

Each feature module should include:

- **model**: MongoDB schema using Mongoose
- **controller**: Request handlers
- **service**: Business logic
- **route**: API endpoints

Example:
```
src/modules/auth/
├── auth.model.js
├── auth.controller.js
├── auth.service.js
└── auth.routes.js
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh-token` - Refresh JWT token

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `POST /api/users/:id/follow` - Follow a user
- `DELETE /api/users/:id/follow` - Unfollow a user

### Posts
- `GET /api/posts` - Get feed
- `POST /api/posts` - Create post
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Comments
- `GET /api/posts/:postId/comments` - Get comments
- `POST /api/posts/:postId/comments` - Add comment
- `DELETE /api/comments/:id` - Delete comment

### Likes
- `POST /api/posts/:postId/like` - Like post
- `DELETE /api/posts/:postId/like` - Unlike post

### Images
- `POST /api/images/upload` - Upload image
- `GET /api/images/:id` - Get image
- `DELETE /api/images/:id` - Delete image

## Development

### Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## Best Practices

1. **Modular Structure**: Each feature is self-contained with model, controller, service, and routes
2. **Separation of Concerns**: Business logic in services, request handling in controllers
3. **Error Handling**: Centralized error handling middleware
4. **Validation**: Input validation using express-validator
5. **Security**: JWT for authentication, bcrypt for password hashing, CORS enabled
6. **Environment Configuration**: Sensitive data in .env file

## Future Enhancements

- [ ] Add real-time notifications with Socket.io
- [ ] Implement caching with Redis
- [ ] Add rate limiting
- [ ] API documentation with Swagger
- [ ] Unit and integration tests
- [ ] Database indexing performance optimization
- [ ] Message/Chat functionality
- [ ] Hashtag search and trending

## License

MIT

## Author

[Your Name]
