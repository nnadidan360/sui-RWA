import Joi from 'joi';
import { logger } from '../utils/logger';

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  
  // Database
  MONGODB_URI: Joi.string().when('NODE_ENV', {
    is: 'development',
    then: Joi.string().default('mongodb://localhost:27017/rwa-lending-backend'),
    otherwise: Joi.string().required()
  }),
  REDIS_URL: Joi.string().optional(),
  
  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Blockchain
  SUI_NETWORK: Joi.string().valid('mainnet', 'testnet', 'devnet').default('testnet'),
  SUI_PRIVATE_KEY: Joi.string().allow('').optional(),
  
  // External Services
  IPFS_GATEWAY_URL: Joi.string().uri().allow('').optional(),
  PINATA_API_KEY: Joi.string().allow('').optional(),
  PINATA_SECRET_KEY: Joi.string().allow('').optional(),
  
  // Email
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  
  // Push Notifications
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
  VAPID_EMAIL: Joi.string().email().allow('').optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // CORS
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
}).unknown();

export const validateEnv = (): void => {
  const { error, value } = envSchema.validate(process.env);
  
  if (error) {
    logger.error('Environment validation failed:', error.details);
    throw new Error(`Environment validation failed: ${error.message}`);
  }
  
  // Update process.env with validated and default values
  Object.assign(process.env, value);
  
  logger.info('Environment validation passed');
};