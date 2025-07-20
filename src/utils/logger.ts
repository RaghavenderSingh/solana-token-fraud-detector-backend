import winston from 'winston';
import { config } from '../config';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { 
    service: 'tokentrust-api',
    environment: config.environment 
  },
  transports: [
    // Error logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (config.environment !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper methods for common logging patterns
export const logAnalysis = (tokenAddress: string, riskScore: number, riskLevel: string, processingTime: number) => {
  logger.info('Token analysis completed', {
    tokenAddress,
    riskScore,
    riskLevel,
    processingTime,
    category: 'analysis'
  });
};

export const logError = (error: Error, context?: string) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    context,
    category: 'error'
  });
};

export const logApiRequest = (method: string, path: string, ip: string, userAgent?: string) => {
  logger.info('API request', {
    method,
    path,
    ip,
    userAgent,
    category: 'api'
  });
};

export const logApiResponse = (method: string, path: string, statusCode: number, responseTime: number) => {
  logger.info('API response', {
    method,
    path,
    statusCode,
    responseTime,
    category: 'api'
  });
};

export const logHeliusRequest = (method: string, endpoint: string, success: boolean, responseTime?: number) => {
  logger.info('Helius API request', {
    method,
    endpoint,
    success,
    responseTime,
    category: 'helius'
  });
};

export const logCacheOperation = (operation: 'get' | 'set' | 'delete', key: string, success: boolean) => {
  logger.info('Cache operation', {
    operation,
    key,
    success,
    category: 'cache'
  });
};

export default logger; 