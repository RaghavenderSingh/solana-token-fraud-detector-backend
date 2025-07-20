import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { RateLimiterMemory } from "rate-limiter-flexible";
import winston from "winston";

// Load environment variables
dotenv.config();

// Import services and routes
import { TokenTrustAnalyzer } from "./core/TokenTrustAnalyzer";
import { HeliusService } from "./services/heliusService";
import { TokenTrustConfig } from "./types";
import { ConnectionMonitor } from "./utils/connectionMonitor";

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "tokentrust-api" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Configuration
const config: TokenTrustConfig = {
  heliusApiKey: process.env.HELIUS_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY,
  redisUrl: process.env.REDIS_URL,
  logLevel:
    (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
  environment:
    (process.env.NODE_ENV as "development" | "production" | "test") ||
    "development",
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // limit each IP to 100 requests per windowMs
  },
};

// Validate required configuration
if (!config.heliusApiKey) {
  logger.error("HELIUS_API_KEY is required");
  process.exit(1);
}

// Initialize services
const analyzer = new TokenTrustAnalyzer(config.heliusApiKey);
const heliusService = new HeliusService(config.heliusApiKey);

// Create Express app
const app = express();
const server = createServer(app);

// Socket.IO rate limiter
const socketRateLimiter = new RateLimiterMemory({
  keyPrefix: "socket_connection",
  points: 10, // Max 10 connections per IP per window
  duration: 60, // 1 minute window
});

// Initialize Socket.IO with security measures
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
  // Security settings
  allowEIO3: false, // Disable older protocol versions
  transports: ["websocket", "polling"], // Allow both transports
  // Connection limits
  maxHttpBufferSize: 1e6, // 1MB max message size
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  // Rate limiting
  connectTimeout: 45000, // 45 seconds
});

// Initialize connection monitor
const connectionMonitor = new ConnectionMonitor(io, logger);

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyPrefix: "server_rate_limit",
  points: config.rateLimit.maxRequests,
  duration: config.rateLimit.windowMs / 1000,
});

const rateLimiterMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    await rateLimiter.consume(req.ip || "unknown");
    next();
  } catch (rejRes: any) {
    res.status(429).json({
      success: false,
      error: "Too many requests",
      retryAfter: Math.round(rejRes.msBeforeNext / 1000),
    });
  }
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiterMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Socket.IO connection spam protection middleware
app.use((req, res, next) => {
  // Block suspicious User-Agents
  const userAgent = req.get("User-Agent") || "";
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /node/i,
    /postman/i,
  ];

  if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
    logger.warn("Blocked suspicious User-Agent", {
      ip: req.ip,
      userAgent,
      path: req.path,
    });
    return res.status(403).json({
      success: false,
      error: "Access denied",
      timestamp: new Date().toISOString(),
    });
  }

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  const stats = connectionMonitor.getStats();
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: config.environment,
    socketConnections: stats.totalConnections,
  });
});

// Socket connection status endpoint
app.get("/api/socket/status", (req, res) => {
  const stats = connectionMonitor.getStats();

  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  });
});

// Force disconnect IP endpoint (admin only)
app.post("/api/socket/disconnect-ip", (req, res) => {
  const { ip, reason } = req.body;

  if (!ip) {
    return res.status(400).json({
      success: false,
      error: "IP address is required",
      timestamp: new Date().toISOString(),
    });
  }

  const disconnectedCount = connectionMonitor.forceDisconnectIP(
    ip,
    reason || "Admin request"
  );

  res.json({
    success: true,
    data: {
      ip,
      disconnectedCount,
      reason: reason || "Admin request",
    },
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.post("/api/analyze", async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Validate token address format
    if (!/^[A-Za-z0-9]{32,44}$/.test(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Starting analysis for token: ${tokenAddress}`);

    // Emit analysis start event
    io.emit("analysis:start", { tokenAddress });

    const startTime = Date.now();
    const analysis = await analyzer.analyzeToken(tokenAddress);
    const processingTime = Date.now() - startTime;

    logger.info(`Analysis completed for ${tokenAddress}`, {
      processingTime,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
    });

    // Emit analysis complete event
    io.emit("analysis:complete", {
      tokenAddress,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
    });

    res.json({
      success: true,
      data: analysis,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Analysis failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Analysis failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get token metadata
app.get("/api/token/:address/metadata", async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || !/^[A-Za-z0-9]{32,44}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        timestamp: new Date().toISOString(),
      });
    }

    const metadata = await heliusService.getTokenMetadata(address);

    res.json({
      success: true,
      data: metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Metadata fetch failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      address: req.params.address,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch metadata",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get token transactions
app.get("/api/token/:address/transactions", async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || !/^[A-Za-z0-9]{32,44}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        timestamp: new Date().toISOString(),
      });
    }

    // Validate and limit the query parameter
    let limit = parseInt(req.query.limit as string) || 10;
    limit = Math.min(Math.max(limit, 1), 100); // Between 1 and 100

    const transactions = await heliusService.getTokenTransactions(
      address,
      limit
    );

    res.json({
      success: true,
      data: transactions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Transactions fetch failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      address: req.params.address,
      limit: req.query.limit,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch transactions",
      timestamp: new Date().toISOString(),
    });
  }
});

// Test Helius connection
app.get("/api/test/helius", async (req, res) => {
  try {
    const isConnected = await heliusService.testConnection();
    res.json({
      success: true,
      data: { connected: isConnected },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Helius test failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Helius connection test failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// Socket.IO connection handling with comprehensive protection
io.on("connection", async (socket) => {
  const clientIP = socket.handshake.address;
  const socketId = socket.id;
  const userAgent = socket.handshake.headers["user-agent"];

  try {
    // Rate limit socket connections per IP
    await socketRateLimiter.consume(clientIP);
  } catch (rejRes: any) {
    logger.warn("Socket connection rate limited", {
      socketId,
      ip: clientIP,
      retryAfter: Math.round(rejRes.msBeforeNext / 1000),
    });
    socket.emit("error", {
      message: "Connection rate limited",
      retryAfter: Math.round(rejRes.msBeforeNext / 1000),
    });
    socket.disconnect(true);
    return;
  }

  // Use connection monitor to manage connections
  const connectionAllowed = connectionMonitor.addConnection(
    socketId,
    clientIP,
    userAgent
  );
  if (!connectionAllowed) {
    socket.emit("error", {
      message: "Too many connections from this IP",
      retryAfter: 60,
    });
    socket.disconnect(true);
    return;
  }

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    connectionMonitor.removeConnection(socketId, reason);
    const stats = connectionMonitor.getStats();
    logger.info("Client disconnected", {
      socketId,
      reason,
      totalConnections: stats.totalConnections,
    });
  });

  // Handle subscription with limits
  socket.on("subscribe:analysis", (data) => {
    // Update activity
    connectionMonitor.updateActivity(socketId);

    // Validate token address
    if (!data.tokenAddress || !/^[A-Za-z0-9]{32,44}$/.test(data.tokenAddress)) {
      socket.emit("error", { message: "Invalid token address" });
      return;
    }

    // Use connection monitor to manage subscription
    const subscriptionAllowed = connectionMonitor.addSubscription(
      socketId,
      data.tokenAddress
    );
    if (!subscriptionAllowed) {
      socket.emit("error", {
        message: "Too many subscriptions",
        maxSubscriptions: 10, // From ConnectionMonitor
      });
      return;
    }

    // Join room
    socket.join(`analysis:${data.tokenAddress}`);

    // Get updated stats for logging
    const stats = connectionMonitor.getStats();
    const connection = connectionMonitor
      .getConnectionsByIP(clientIP)
      .find((c) => c.socketId === socketId);

    logger.info("Client subscribed to analysis updates", {
      socketId,
      tokenAddress: data.tokenAddress,
      subscriptionCount: connection?.subscriptionCount || 0,
    });

    // Send confirmation
    socket.emit("subscribed", {
      tokenAddress: data.tokenAddress,
      subscriptionCount: connection?.subscriptionCount || 0,
    });
  });

  // Handle unsubscription
  socket.on("unsubscribe:analysis", (data) => {
    connectionMonitor.updateActivity(socketId);
    connectionMonitor.removeSubscription(socketId, data.tokenAddress);
    socket.leave(`analysis:${data.tokenAddress}`);

    // Get updated stats for logging
    const connection = connectionMonitor
      .getConnectionsByIP(clientIP)
      .find((c) => c.socketId === socketId);

    logger.info("Client unsubscribed from analysis updates", {
      socketId,
      tokenAddress: data.tokenAddress,
      subscriptionCount: connection?.subscriptionCount || 0,
    });
  });

  // Handle ping/pong for activity tracking
  socket.on("ping", () => {
    connectionMonitor.updateActivity(socketId);
    socket.emit("pong");
  });

  // Handle errors
  socket.on("error", (error) => {
    logger.error("Socket error", { socketId, error });
  });
});

// Cleanup is now handled by ConnectionMonitor automatically

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`🚀 TokenTrust API server running on port ${PORT}`, {
    environment: config.environment,
    version: process.env.npm_package_version || "1.0.0",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  connectionMonitor.stop();
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  connectionMonitor.stop();
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

export default app;
