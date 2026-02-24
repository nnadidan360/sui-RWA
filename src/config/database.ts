import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000, // Added connection timeout
      bufferCommands: false,
      retryWrites: true,
      retryReads: true,
    };

    logger.info('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, options);
    
    logger.info('✅ Connected to MongoDB successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
  } catch (error: any) {
    logger.error('Failed to connect to MongoDB:', {
      error: error.message,
      code: error.code,
      name: error.name
    });
    
    // Provide helpful error messages
    if (error.message?.includes('IP') || error.message?.includes('whitelist')) {
      logger.error('💡 Tip: Check your MongoDB Atlas Network Access settings');
      logger.error('   1. Go to https://cloud.mongodb.com');
      logger.error('   2. Select your cluster');
      logger.error('   3. Click "Network Access"');
      logger.error('   4. Add your current IP or allow 0.0.0.0/0 for testing');
    }
    
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};