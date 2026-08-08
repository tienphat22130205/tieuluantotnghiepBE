const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  // Handle DNS resolution issues for MongoDB Atlas SRV records (common with some ISPs in Vietnam)
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    try {
      const match = process.env.MONGODB_URI.match(/@([^/?#:]+)/);
      if (match) {
        const host = match[1];
        await new Promise((resolve, reject) => {
          dns.resolveSrv(`_mongodb._tcp.${host}`, (err, addresses) => {
            if (err) {
              reject(err);
            } else {
              resolve(addresses);
            }
          });
        });
      }
    } catch (dnsErr) {
      console.log('Detecting DNS resolution issue for MongoDB Atlas. Switching to Google DNS (8.8.8.8)...');
      try {
        dns.setServers(['8.8.8.8', '8.8.4.4']);
      } catch (err) {
        console.warn('Failed to set Google DNS servers:', err.message);
      }
    }
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Fix legacy non-sparse phone_1 index on MongoDB Atlas if present
    try {
      const User = require('../modules/auth/auth.model');
      User.collection.dropIndex('phone_1')
        .then(() => User.syncIndexes())
        .catch(() => {});
    } catch {
      // Ignore index sync errors
    }

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
