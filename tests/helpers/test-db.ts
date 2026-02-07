/**
 * Test Database Helper
 * Provides utilities for connecting to and managing test database
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export const connectTestDB = async (): Promise<void> => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
    console.log('Connected to test database');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
};

export const disconnectTestDB = async (): Promise<void> => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('Disconnected from test database');
  } catch (error) {
    console.error('Failed to disconnect from test database:', error);
    throw error;
  }
};

export const clearTestDB = async (): Promise<void> => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (error) {
    console.error('Failed to clear test database:', error);
    throw error;
  }
};