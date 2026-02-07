import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found-handler';
import { authMiddleware } from './middleware/auth-middleware';
import { validateEnv } from './config/env-validation';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { getRealtimeService } from './services/realtime/realtime-service';

// Import route handlers
import healthRoutes from './controllers/health';
import authRoutes from './controllers/auth';
import userRoutes from './controllers/users';
import assetRoutes from './routes/assets';
import cryptoRoutes from './routes/crypto';
import blockchainRoutes from './controllers/blockchain';
import ipfsRoutes from './controllers/ipfs';
import notificationRoutes from './controllers/notifications';
import realtimeRoutes from './routes/realtime';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnv();

const app = express();
const server = createServer(app);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Health check routes (no auth required)
app.use('/api/health', healthRoutes);

// Authentication routes (no auth required for login/register)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api', authMiddleware);

// Add protected route handlers
app.use('/api/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/realtime', realtimeRoutes);
// app.use('/api/loans', loanRoutes);
// app.use('/api/transactions', transactionRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start real-time service
    const realtimeService = getRealtimeService();
    realtimeService.start();
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop real-time service
  const realtimeService = getRealtimeService();
  realtimeService.stop();
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop real-time service
  const realtimeService = getRealtimeService();
  realtimeService.stop();
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

export { app, server };