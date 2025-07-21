import express from "express";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";

const router = express.Router();

/**
 * GET /api/config
 * Get API configuration and feature information
 */
router.get("/", rateLimiterMiddleware, (req, res) => {
  const config = {
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    features: {
      tokenAnalysis: true,
      dexAnalysis: true,
      verification: true,
      batchAnalysis: true,
      realTimeMonitoring: false, // Coming soon
      aiInsights: false, // Coming soon
      socialAnalysis: false, // Coming soon
      portfolioTracking: false, // Coming soon
    },
    endpoints: {
      analysis: {
        comprehensive: "POST /api/analyze",
        quick: "GET /api/analyze/:tokenAddress",
        batch: "POST /api/verify/batch",
      },
      verification: {
        token: "POST /api/verify/token",
        batch: "POST /api/verify/batch",
        sources: "GET /api/verify/sources",
        cache: {
          stats: "GET /api/verify/cache/stats",
          clear: "DELETE /api/verify/cache",
        },
      },
      dex: {
        analyze: "GET /api/dex/analyze/:tokenAddress",
        liquidity: "GET /api/dex/liquidity/:tokenAddress",
        volume: "GET /api/dex/volume/:tokenAddress",
        price: "GET /api/dex/price/:tokenAddress",
        pools: "GET /api/dex/pools/:tokenAddress",
      },
      system: {
        health: "GET /health",
        config: "GET /api/config",
      },
    },
    rateLimits: {
      free: {
        requests: 100,
        window: "15 minutes",
        endpoints: ["All endpoints"],
      },
      pro: {
        requests: 1000,
        window: "15 minutes",
        endpoints: ["All endpoints + priority queue"],
      },
      enterprise: {
        requests: 10000,
        window: "15 minutes",
        endpoints: ["All endpoints + dedicated infrastructure"],
      },
    },
    dataSources: {
      blockchain: ["Helius API", "Solana RPC"],
      dex: ["Jupiter", "Raydium", "Orca", "Meteora"],
      verification: ["System Registry", "Community Verification"],
      price: ["CoinGecko", "DEX Aggregators"],
    },
    supportedChains: ["Solana"], // Future: ["Solana", "Ethereum", "BSC"]
    timestamp: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: config,
  });
});

/**
 * GET /api/config/features
 * Get detailed feature information
 */
router.get("/features", rateLimiterMiddleware, (req, res) => {
  const features = {
    tokenAnalysis: {
      enabled: true,
      description: "Comprehensive token risk analysis",
      capabilities: [
        "Mint authority analysis",
        "Freeze authority analysis",
        "Transaction pattern analysis",
        "Holder distribution analysis",
        "Risk scoring and assessment",
      ],
    },
    dexAnalysis: {
      enabled: true,
      description: "DEX liquidity and trading analysis",
      capabilities: [
        "Multi-DEX liquidity analysis",
        "Volume and price analysis",
        "Rug pull detection",
        "Pool distribution analysis",
        "Price impact calculation",
      ],
    },
    verification: {
      enabled: true,
      description: "Token verification and trust assessment",
      capabilities: [
        "Official token verification",
        "Community verification",
        "Source validation",
        "Confidence scoring",
        "Batch verification",
      ],
    },
    batchAnalysis: {
      enabled: true,
      description: "Analyze multiple tokens simultaneously",
      capabilities: [
        "Up to 10 tokens per request",
        "Parallel processing",
        "Individual error handling",
        "Bulk risk assessment",
      ],
    },
    realTimeMonitoring: {
      enabled: false,
      description: "Real-time token monitoring and alerts",
      capabilities: [
        "WebSocket connections",
        "Live price monitoring",
        "Liquidity change alerts",
        "Whale movement detection",
        "Custom alert thresholds",
      ],
      eta: "Q2 2024",
    },
    aiInsights: {
      enabled: false,
      description: "AI-powered risk insights and explanations",
      capabilities: [
        "Natural language explanations",
        "Contextual risk assessment",
        "Pattern recognition",
        "Predictive analysis",
        "Custom recommendations",
      ],
      eta: "Q3 2024",
    },
    socialAnalysis: {
      enabled: false,
      description: "Social media sentiment and community analysis",
      capabilities: [
        "Twitter sentiment analysis",
        "Telegram community health",
        "Discord activity monitoring",
        "Influencer tracking",
        "Community growth metrics",
      ],
      eta: "Q4 2024",
    },
    portfolioTracking: {
      enabled: false,
      description: "Portfolio risk management and tracking",
      capabilities: [
        "Multi-token portfolio analysis",
        "Risk diversification scoring",
        "Portfolio alerts",
        "Historical performance",
        "Risk-adjusted returns",
      ],
      eta: "Q1 2025",
    },
  };

  res.json({
    success: true,
    data: features,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/config/limits
 * Get current rate limit information
 */
router.get("/limits", rateLimiterMiddleware, (req, res) => {
  const limits = {
    current: {
      requests: 100,
      window: "15 minutes",
      remaining: "Based on your plan",
    },
    plans: {
      free: {
        requests: 100,
        window: "15 minutes",
        features: ["Basic analysis", "Standard rate limits"],
        price: "Free",
      },
      pro: {
        requests: 1000,
        window: "15 minutes",
        features: ["Advanced analysis", "Priority queue", "Batch processing"],
        price: "$29/month",
      },
      enterprise: {
        requests: 10000,
        window: "15 minutes",
        features: ["All features", "Dedicated infrastructure", "Custom limits"],
        price: "Contact sales",
      },
    },
    upgrade: {
      url: "https://tokentrust.dev/pricing",
      contact: "sales@tokentrust.dev",
    },
    timestamp: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: limits,
  });
});

export default router;
