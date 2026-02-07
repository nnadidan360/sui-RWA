import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Global setup is disabled - each test file manages its own database connection
// This prevents hanging issues with MongoMemoryServer

// Increase timeout for all tests
jest.setTimeout(30000);