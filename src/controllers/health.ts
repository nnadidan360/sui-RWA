import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis?: 'connected' | 'disconnected' | 'error';
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Basic health check
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    },
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
  };

  // Check if any critical services are down
  if (healthStatus.services.database !== 'connected') {
    healthStatus.status = 'unhealthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json({
    success: healthStatus.status === 'healthy',
    data: healthStatus,
    timestamp: new Date().toISOString(),
  });
}));

// Detailed health check with dependency testing
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const checks = {
    database: false,
    redis: false,
  };

  // Test database connection
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      checks.database = true;
    }
  } catch (error) {
    logger.error('Database health check failed:', error);
  }

  // Test Redis connection (if configured)
  if (process.env.REDIS_URL) {
    try {
      // Redis health check would go here
      // For now, we'll assume it's working if URL is configured
      checks.redis = true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }
  } else {
    checks.redis = true; // Not configured, so consider it "healthy"
  }

  const allHealthy = Object.values(checks).every(check => check === true);

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
}));

// Readiness probe (for Kubernetes)
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  const isReady = mongoose.connection.readyState === 1;
  
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    data: {
      ready: isReady,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
}));

// Liveness probe (for Kubernetes)
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      alive: true,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
}));

export default router;