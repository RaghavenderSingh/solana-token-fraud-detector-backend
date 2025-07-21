import express from "express";
import { DEXService } from "../services/dexService";

const router = express.Router();
const dexService = new DEXService();

/**
 * GET /api/dex/analyze/:tokenAddress
 * Comprehensive DEX analysis for a token
 */
router.get("/analyze/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`🔍 DEX Analysis requested for: ${tokenAddress}`);

    const dexData = await dexService.analyzeDEXData(tokenAddress);

    if (!dexData) {
      return res.status(404).json({
        success: false,
        error: "No DEX data available for this token",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: dexData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ DEX analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze DEX data",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/dex/liquidity/:tokenAddress
 * Get liquidity data for a token
 */
router.get("/liquidity/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    const liquidityData = await dexService.getLiquidityData(tokenAddress);

    if (!liquidityData) {
      return res.status(404).json({
        success: false,
        error: "No liquidity data available",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: liquidityData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Liquidity analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get liquidity data",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/dex/volume/:tokenAddress
 * Get volume data for a token
 */
router.get("/volume/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    const volumeData = await dexService.getVolumeAnalysis(tokenAddress);

    if (!volumeData) {
      return res.status(404).json({
        success: false,
        error: "No volume data available",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: volumeData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Volume analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get volume data",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/dex/price/:tokenAddress
 * Get price data for a token
 */
router.get("/price/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    const priceData = await dexService.getPriceData(tokenAddress);

    if (!priceData) {
      return res.status(404).json({
        success: false,
        error: "No price data available",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: priceData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Price analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get price data",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/dex/pools/:tokenAddress
 * Get DEX pools for a token
 */
router.get("/pools/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    const pools = await dexService.getDEXPools(tokenAddress);

    res.json({
      success: true,
      data: pools,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Pools analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pools data",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/dex/rug-pull-risk/:tokenAddress
 * Get rug pull risk assessment for a token
 */
router.get("/rug-pull-risk/:tokenAddress", async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
        timestamp: new Date().toISOString(),
      });
    }

    const dexData = await dexService.analyzeDEXData(tokenAddress);

    if (!dexData) {
      return res.status(404).json({
        success: false,
        error: "No DEX data available for rug pull analysis",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        rugPullRisk: dexData.rugPullRisk,
        liquidity: dexData.liquidity,
        volume: dexData.volume,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Rug pull risk analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze rug pull risk",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
