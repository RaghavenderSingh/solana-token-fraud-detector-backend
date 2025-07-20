import { Request, Response, NextFunction } from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { config } from "../config";
import logger from "../utils/logger";

// Create rate limiter instance
const rateLimiter = new RateLimiterMemory({
  keyPrefix: "rate_limit",
  points: config.rateLimit.maxRequests,
  duration: config.rateLimit.windowMs / 1000, // Convert to seconds
  blockDuration: 60 * 15, // Block for 15 minutes if limit exceeded
});

// Rate limiting middleware
export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await rateLimiter.consume(req.ip || "unknown");
    next();
  } catch (rejRes: any) {
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000);

    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      retryAfter,
      category: "rate-limit",
    });

    res.status(429).json({
      success: false,
      error: "Too many requests",
      retryAfter,
      timestamp: new Date().toISOString(),
    });
  }
};

// Specific rate limiter for analysis endpoints (more restrictive)
const analysisRateLimiter = new RateLimiterMemory({
  keyPrefix: "analysis_rate_limit",
  points: 10, // Only 10 analysis requests per window
  duration: config.rateLimit.windowMs / 1000,
  blockDuration: 60 * 30, // Block for 30 minutes
});

export const analysisRateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await analysisRateLimiter.consume(req.ip || "unknown");
    next();
  } catch (rejRes: any) {
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000);

    logger.warn("Analysis rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      retryAfter,
      category: "rate-limit",
    });

    res.status(429).json({
      success: false,
      error:
        "Analysis rate limit exceeded. Please wait before making more analysis requests.",
      retryAfter,
      timestamp: new Date().toISOString(),
    });
  }
};

// Rate limiter for Helius API calls
const heliusRateLimiter = new RateLimiterMemory({
  keyPrefix: "helius_rate_limit",
  points: 50, // 50 Helius API calls per window
  duration: config.rateLimit.windowMs / 1000,
  blockDuration: 60 * 10, // Block for 10 minutes
});

export const heliusRateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await heliusRateLimiter.consume(req.ip || "unknown");
    next();
  } catch (rejRes: any) {
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000);

    logger.warn("Helius API rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      retryAfter,
      category: "rate-limit",
    });

    res.status(429).json({
      success: false,
      error: "Helius API rate limit exceeded",
      retryAfter,
      timestamp: new Date().toISOString(),
    });
  }
};

export default rateLimiterMiddleware;
