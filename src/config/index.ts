import dotenv from "dotenv";
import { TokenTrustConfig } from "../types";

// Load environment variables
dotenv.config();

// Default configuration
const defaultConfig: TokenTrustConfig = {
  heliusApiKey: "",
  openaiApiKey: undefined,
  redisUrl: undefined,
  logLevel: "info",
  environment: "development",
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
};

// Environment-specific configurations
const configs = {
  development: {
    ...defaultConfig,
    logLevel: "debug" as const,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 1000, // Higher limit for development
    },
  },
  production: {
    ...defaultConfig,
    logLevel: "info" as const,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    },
  },
  test: {
    ...defaultConfig,
    logLevel: "error" as const,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 1000,
    },
  },
};

// Get current environment
const environment =
  (process.env.NODE_ENV as "development" | "production" | "test") ||
  "development";

// Build configuration
export const config: TokenTrustConfig = {
  ...configs[environment],
  heliusApiKey: process.env.HELIUS_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  redisUrl: process.env.REDIS_URL,
  environment,
  logLevel:
    (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
    configs[environment].logLevel,
};

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.heliusApiKey) {
    errors.push("HELIUS_API_KEY is required");
  }

  if (config.environment === "production" && !config.redisUrl) {
    errors.push("REDIS_URL is required in production");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }
}

// Export individual config sections for convenience
export const { heliusApiKey, openaiApiKey, redisUrl, logLevel, rateLimit } =
  config;

export default config;
