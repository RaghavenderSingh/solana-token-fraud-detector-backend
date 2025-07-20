import express from "express";
import { VerificationService } from "../services/verificationService";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import logger from "../utils/logger";

const router = express.Router();

let verificationService: VerificationService;

export function initializeVerificationRoutes(heliusApiKey: string) {
  verificationService = new VerificationService(heliusApiKey);
  return router;
}

router.post("/token", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    if (!/^[A-Za-z0-9]{32,44}$/.test(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Verifying token: ${tokenAddress}`);

    const startTime = Date.now();
    const verificationResult =
      await verificationService.verifyToken(tokenAddress);
    const processingTime = Date.now() - startTime;

    logger.info(`Token verification completed for ${tokenAddress}`, {
      processingTime,
      isVerified: verificationResult.isVerified,
      verificationLevel: verificationResult.verificationLevel,
      confidence: verificationResult.confidence,
    });

    res.json({
      success: true,
      data: verificationResult,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Token verification failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      tokenAddress: req.body.tokenAddress,
    });
    res.status(500).json({
      success: false,
      error: "Verification failed",
      timestamp: new Date().toISOString(),
    });
  }
});

router.post("/batch", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddresses } = req.body;

    if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Token addresses array is required",
        timestamp: new Date().toISOString(),
      });
    }

    if (tokenAddresses.length > 10) {
      return res.status(400).json({
        success: false,
        error: "Maximum 10 tokens per batch request",
        timestamp: new Date().toISOString(),
      });
    }

    for (const address of tokenAddresses) {
      if (!/^[A-Za-z0-9]{32,44}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: `Invalid token address format: ${address}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    logger.info(`Batch verifying ${tokenAddresses.length} tokens`);

    const startTime = Date.now();
    const results = await Promise.allSettled(
      tokenAddresses.map((address: string) =>
        verificationService.verifyToken(address)
      )
    );

    const verificationResults = results.map((result, index) => ({
      tokenAddress: tokenAddresses[index],
      ...(result.status === "fulfilled"
        ? { success: true, data: result.value }
        : { success: false, error: "Verification failed" }),
    }));

    const processingTime = Date.now() - startTime;

    logger.info(`Batch verification completed`, {
      processingTime,
      totalTokens: tokenAddresses.length,
      successful: verificationResults.filter((r) => r.success).length,
    });

    res.json({
      success: true,
      data: verificationResults,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Batch verification failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Batch verification failed",
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/cache/stats", rateLimiterMiddleware, async (req, res) => {
  try {
    const stats = verificationService.getCacheStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get cache stats", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to get cache statistics",
      timestamp: new Date().toISOString(),
    });
  }
});

router.delete("/cache", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    if (tokenAddress) {
      if (!/^[A-Za-z0-9]{32,44}$/.test(tokenAddress)) {
        return res.status(400).json({
          success: false,
          error: "Invalid token address format",
          timestamp: new Date().toISOString(),
        });
      }
      verificationService.clearCache(tokenAddress);
      logger.info(`Cleared verification cache for ${tokenAddress}`);
    } else {
      verificationService.clearCache();
      logger.info("Cleared entire verification cache");
    }

    res.json({
      success: true,
      message: tokenAddress
        ? `Cache cleared for ${tokenAddress}`
        : "Entire cache cleared",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to clear cache", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to clear cache",
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/sources", rateLimiterMiddleware, async (req, res) => {
  try {
    const sources = [
      {
        name: "CoinGecko",
        type: "market_data",
        weight: 40,
        description: "Professional market data and listings",
      },
      {
        name: "Jupiter Token List",
        type: "dex_aggregator",
        weight: 30,
        description: "Jupiter DEX aggregator token registry",
      },
      {
        name: "Solana Token Registry",
        type: "official_registry",
        weight: 25,
        description: "Official Solana Labs token registry",
      },
      {
        name: "On-chain Metadata",
        type: "blockchain",
        weight: 15,
        description: "On-chain token metadata verification",
      },
      {
        name: "DEX Liquidity",
        type: "liquidity",
        weight: 20,
        description: "Liquidity presence on major DEXes",
      },
      {
        name: "Governance Tokens",
        type: "governance",
        weight: 35,
        description: "Known protocol governance tokens",
      },
    ];

    res.json({
      success: true,
      data: {
        sources,
        totalSources: sources.length,
        verificationLevels: [
          {
            level: "OFFICIAL",
            minWeight: 60,
            minConfidence: 80,
            description: "Verified on multiple major platforms",
          },
          {
            level: "ESTABLISHED",
            minWeight: 40,
            minConfidence: 60,
            description: "Well-recognized in the ecosystem",
          },
          {
            level: "COMMUNITY",
            minWeight: 20,
            minConfidence: 40,
            description: "Some verification signals present",
          },
          {
            level: "UNVERIFIED",
            minWeight: 0,
            minConfidence: 0,
            description: "No verification found",
          },
        ],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get verification sources", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      error: "Failed to get verification sources",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
