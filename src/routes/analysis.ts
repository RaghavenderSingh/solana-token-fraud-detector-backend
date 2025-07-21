import express from "express";
import { TokenTrustAnalyzer } from "../core/TokenTrustAnalyzer";
import { VerificationService } from "../services/verificationService";
import { DEXService } from "../services/dexService";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import logger from "../utils/logger";

const router = express.Router();

let analyzer: TokenTrustAnalyzer;
let verificationService: VerificationService;
let dexService: DEXService;

export function initializeAnalysisRoutes(heliusApiKey: string) {
  analyzer = new TokenTrustAnalyzer(heliusApiKey);
  verificationService = new VerificationService(heliusApiKey);
  dexService = new DEXService();
  return router;
}

/**
 * POST /api/analyze
 * Comprehensive token analysis combining verification, DEX data, and risk assessment
 */
router.post("/", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        code: "MISSING_ADDRESS",
        timestamp: new Date().toISOString(),
      });
    }

    if (!/^[A-Za-z0-9]{32,44}$/.test(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        code: "INVALID_ADDRESS",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Starting comprehensive analysis for token: ${tokenAddress}`);

    const startTime = Date.now();

    // Run all analyses in parallel for better performance
    const [verificationResult, dexData, coreAnalysis] =
      await Promise.allSettled([
        verificationService.verifyToken(tokenAddress),
        dexService.analyzeDEXData(tokenAddress),
        analyzer.analyzeToken(tokenAddress),
      ]);

    const processingTime = Date.now() - startTime;

    // Handle individual analysis failures gracefully
    const verification =
      verificationResult.status === "fulfilled"
        ? verificationResult.value
        : null;
    const dex = dexData.status === "fulfilled" ? dexData.value : null;
    const core =
      coreAnalysis.status === "fulfilled" ? coreAnalysis.value : null;

    // Build comprehensive response
    const analysisResult = {
      token: {
        address: tokenAddress,
        name: core?.tokenInfo?.name || "Unknown",
        symbol: core?.tokenInfo?.symbol || "Unknown",
        decimals: core?.tokenInfo?.decimals || 0,
        supply: core?.tokenInfo?.supply || "0",
        price:
          dex?.priceData?.currentPrice ||
          core?.tokenInfo?.priceInfo?.price_per_token ||
          null,
      },
      verification: verification
        ? {
            status: verification.isVerified ? "VERIFIED" : "UNVERIFIED",
            confidence: verification.confidence,
            sources: verification.sources,
            description: verification.reasons.join(", "),
          }
        : {
            status: "UNKNOWN",
            confidence: 0,
            sources: [],
            description: "Verification analysis failed",
          },
      security: core?.mintInfo
        ? {
            mintAuthority: core.mintInfo.mintRevoked ? "REVOKED" : "ACTIVE",
            freezeAuthority: core.mintInfo.freezeRevoked ? "REVOKED" : "ACTIVE",
            isLocked: core.mintInfo.mintRevoked && core.mintInfo.freezeRevoked,
          }
        : {
            mintAuthority: "UNKNOWN",
            freezeAuthority: "UNKNOWN",
            isLocked: false,
          },
      transactions: core?.transactionData
        ? {
            total: core.transactionData.totalTransactions || 0,
            daysActive: core.transactionData.timeSpan?.daysActive || 0,
            transferPatterns: {
              normal: !core.transactionData.suspiciousActivity?.detected,
              suspicious:
                core.transactionData.suspiciousActivity?.detected || false,
            },
            accountActivity: {
              active: core.transactionData.accountActivity?.activeAccounts > 0,
              creatorBehavior: "NORMAL",
            },
          }
        : {
            total: 0,
            daysActive: 0,
            transferPatterns: { normal: false, suspicious: false },
            accountActivity: { active: false, creatorBehavior: "UNKNOWN" },
          },
      dexData: dex
        ? {
            liquidity: {
              total: dex.liquidity?.totalLiquidity || 0,
              currency: "USD",
            },
            volume: {
              daily: dex.volume?.volume24h || 0,
              currency: "USD",
            },
            price: {
              current: dex.priceData?.currentPrice || 0,
              currency: "USD",
            },
            pools: {
              count: dex.liquidity?.poolCount || 0,
              exchanges: Object.keys(dex.liquidity?.dexDistribution || {}),
            },
            marketCap: dex.priceData?.marketCap || 0,
            volumeLiquidityAnalysis: dex.volumeLiquidityAnalysis
              ? {
                  ratio: dex.volumeLiquidityAnalysis.ratio,
                  context: dex.volumeLiquidityAnalysis.context,
                  confidence: dex.volumeLiquidityAnalysis.confidence,
                  explanation: dex.volumeLiquidityAnalysis.explanation,
                  factors: dex.volumeLiquidityAnalysis.factors,
                }
              : null,
          }
        : {
            liquidity: { total: 0, currency: "USD" },
            volume: { daily: 0, currency: "USD" },
            price: { current: 0, currency: "USD" },
            pools: { count: 0, exchanges: [] },
            marketCap: 0,
            volumeLiquidityAnalysis: null,
          },
      riskAssessment: {
        score: core?.riskScore || 50,
        level: core?.riskLevel || "UNKNOWN",
        factors: {
          safety: core?.safetyFactors || [],
          risk: core?.riskFactors || [],
        },
      },
      recommendations: core?.recommendations || [],
      processingTime,
      timestamp: new Date().toISOString(),
    };

    logger.info(`Analysis completed for ${tokenAddress}`, {
      processingTime,
      riskScore: analysisResult.riskAssessment.score,
      riskLevel: analysisResult.riskAssessment.level,
      isVerified: analysisResult.verification.status === "VERIFIED",
    });

    res.json({
      success: true,
      data: analysisResult,
    });
  } catch (error) {
    logger.error("Comprehensive analysis failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      tokenAddress: req.body.tokenAddress,
    });
    res.status(500).json({
      success: false,
      error: "Analysis failed",
      code: "ANALYSIS_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/analyze/:tokenAddress
 * Quick analysis using GET method for simple token checks
 */
router.get("/:tokenAddress", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!/^[A-Za-z0-9]{32,44}$/.test(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        code: "INVALID_ADDRESS",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Quick analysis requested for: ${tokenAddress}`);

    const startTime = Date.now();

    // For GET requests, run a lighter analysis
    const [verificationResult, dexData] = await Promise.allSettled([
      verificationService.verifyToken(tokenAddress),
      dexService.analyzeDEXData(tokenAddress),
    ]);

    const processingTime = Date.now() - startTime;

    const verification =
      verificationResult.status === "fulfilled"
        ? verificationResult.value
        : null;
    const dex = dexData.status === "fulfilled" ? dexData.value : null;

    const quickAnalysis = {
      token: {
        address: tokenAddress,
        name: "Unknown",
        symbol: "Unknown",
        price: dex?.priceData?.currentPrice || null,
      },
      verification: verification
        ? {
            status: verification.isVerified ? "VERIFIED" : "UNVERIFIED",
            confidence: verification.confidence,
          }
        : {
            status: "UNKNOWN",
            confidence: 0,
          },
      dexData: dex
        ? {
            liquidity: dex.liquidity?.totalLiquidity || 0,
            volume: dex.volume?.volume24h || 0,
            pools: dex.liquidity?.poolCount || 0,
          }
        : {
            liquidity: 0,
            volume: 0,
            pools: 0,
          },
      processingTime,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: quickAnalysis,
    });
  } catch (error) {
    logger.error("Quick analysis failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      tokenAddress: req.params.tokenAddress,
    });
    res.status(500).json({
      success: false,
      error: "Quick analysis failed",
      code: "ANALYSIS_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
