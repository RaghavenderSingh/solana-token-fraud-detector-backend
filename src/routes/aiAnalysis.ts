import express from "express";
import { TokenTrustAnalyzer } from "../core/TokenTrustAnalyzer";
import { VerificationService } from "../services/verificationService";
import { DEXService } from "../services/dexService";
import { GeminiService } from "../services/geminiService";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import logger from "../utils/logger";

const router = express.Router();

let analyzer: TokenTrustAnalyzer;
let verificationService: VerificationService;
let dexService: DEXService;
let geminiService: GeminiService;

export function initializeAIAnalysisRoutes(
  heliusApiKey: string,
  geminiApiKey?: string
) {
  analyzer = new TokenTrustAnalyzer(heliusApiKey);
  verificationService = new VerificationService(heliusApiKey);
  dexService = new DEXService();

  if (geminiApiKey) {
    geminiService = new GeminiService({ apiKey: geminiApiKey });
  }

  return router;
}

/**
 * POST /api/ai-analyze
 * Enhanced analysis with Gemini AI insights
 */
router.post("/", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddress, includeAI = true } = req.body;

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

    logger.info(`Starting AI-enhanced analysis for token: ${tokenAddress}`);

    const startTime = Date.now();

    // Run core analysis first
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
    const analysisResult: any = {
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
          }
        : {
            liquidity: { total: 0, currency: "USD" },
            volume: { daily: 0, currency: "USD" },
            price: { current: 0, currency: "USD" },
            pools: { count: 0, exchanges: [] },
            marketCap: 0,
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

    // Add AI analysis if requested and available
    let aiAnalysis = null;
    if (includeAI && geminiService) {
      try {
        logger.info(`Requesting AI analysis for ${tokenAddress}`);
        aiAnalysis = await geminiService.analyzeTokenWithAI(analysisResult);

        // Add AI insights to the response
        analysisResult.aiInsights = {
          summary: aiAnalysis.summary,
          legitimacy: aiAnalysis.legitimacy,
          riskFactors: aiAnalysis.riskFactors,
          positiveIndicators: aiAnalysis.positiveIndicators,
          investmentRecommendation: aiAnalysis.investmentRecommendation,
          confidence: aiAnalysis.confidence,
          warnings: aiAnalysis.warnings,
          aiInsights: aiAnalysis.aiInsights,
        };

        // Get enhanced recommendations
        const enhancedRecommendations =
          await geminiService.getEnhancedRecommendations(analysisResult);
        analysisResult.enhancedRecommendations = enhancedRecommendations;
      } catch (aiError) {
        logger.error("AI analysis failed, continuing with core analysis", {
          aiError,
        });
        analysisResult.aiInsights = {
          summary: "AI analysis unavailable",
          legitimacy: "UNKNOWN",
          riskFactors: [],
          positiveIndicators: [],
          investmentRecommendation: "UNKNOWN",
          confidence: 0,
          warnings: ["AI analysis failed"],
          aiInsights: "Using automated risk assessment only",
        };
      }
    }

    logger.info(`AI-enhanced analysis completed for ${tokenAddress}`, {
      processingTime,
      riskScore: analysisResult.riskAssessment.score,
      riskLevel: analysisResult.riskAssessment.level,
      isVerified: analysisResult.verification.status === "VERIFIED",
      aiIncluded: !!aiAnalysis,
    });

    res.json({
      success: true,
      data: analysisResult,
    });
  } catch (error) {
    logger.error("AI-enhanced analysis failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      tokenAddress: req.body.tokenAddress,
    });
    res.status(500).json({
      success: false,
      error: "AI-enhanced analysis failed",
      code: "ANALYSIS_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/ai-analyze/:tokenAddress
 * Quick AI analysis using GET method
 */
router.get("/:tokenAddress", rateLimiterMiddleware, async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { includeAI = true } = req.query;

    if (!/^[A-Za-z0-9]{32,44}$/.test(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token address format",
        code: "INVALID_ADDRESS",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Quick AI analysis requested for: ${tokenAddress}`);

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

    const quickAnalysis: any = {
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
      security: {
        mintAuthority: "UNKNOWN",
        freezeAuthority: "UNKNOWN",
        isLocked: false,
      },
      transactions: {
        total: 0,
        daysActive: 0,
        transferPatterns: {
          normal: true,
          suspicious: false,
        },
        accountActivity: {
          active: false,
          creatorBehavior: "UNKNOWN",
        },
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
      riskAssessment: {
        score: 50,
        level: "UNKNOWN",
        factors: {
          safety: [],
          risk: [],
        },
      },
      recommendations: [],
      processingTime,
      timestamp: new Date().toISOString(),
    };

    // Add basic AI insights if available
    if (includeAI === "true" && geminiService) {
      try {
        const aiInsights =
          await geminiService.analyzeTokenWithAI(quickAnalysis);
        quickAnalysis.aiInsights = {
          summary: aiInsights.summary,
          legitimacy: aiInsights.legitimacy,
          investmentRecommendation: aiInsights.investmentRecommendation,
        };
      } catch (aiError) {
        logger.error("Quick AI analysis failed", { aiError });
      }
    }

    res.json({
      success: true,
      data: quickAnalysis,
    });
  } catch (error) {
    logger.error("Quick AI analysis failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      tokenAddress: req.params.tokenAddress,
    });
    res.status(500).json({
      success: false,
      error: "Quick AI analysis failed",
      code: "ANALYSIS_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
