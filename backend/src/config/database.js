'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

let retryCount = 0;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established successfully');
    retryCount = 0;
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
    retryCount = 0;
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed due to app termination');
    process.exit(0);
  });

  await attemptConnection(uri, options);
};

const attemptConnection = async (uri, options) => {
  try {
    await mongoose.connect(uri, options);
  } catch (err) {
    logger.error(`MongoDB initial connection failed: ${err.message}`);
    scheduleReconnect(uri, options);
  }
};

const scheduleReconnect = (uri, options) => {
  if (retryCount >= MAX_RETRIES) {
    logger.error(`MongoDB: max retries (${MAX_RETRIES}) reached. Giving up.`);
    process.exit(1);
  }
  retryCount += 1;
  const delay = RETRY_DELAY_MS * retryCount;
  logger.info(`MongoDB: retrying connection in ${delay / 1000}s (attempt ${retryCount}/${MAX_RETRIES})...`);
  setTimeout(async () => {
    try {
      await mongoose.connect(uri, options);
    } catch (err) {
      logger.error(`MongoDB retry ${retryCount} failed: ${err.message}`);
      scheduleReconnect(uri, options);
    }
  }, delay);
};

module.exports = connectDB;
