require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const seedDefaultAdmin = require('./modules/auth/seed-admin');
const { startRetentionCleanupJob } = require('./services/retention-cleanup.service');
const { initSocketServer } = require('./realtime/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/', routes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Đường dẫn không tồn tại',
  });
});

const startServer = async () => {
  await connectDB();
  await seedDefaultAdmin();
  startRetentionCleanupJob();
  initSocketServer(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
};

startServer();

module.exports = app;
