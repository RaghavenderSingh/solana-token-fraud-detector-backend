import axios from "axios";
import {
  LiquidityAnalysis,
  VolumeAnalysis,
  RugPullRisk,
  LockStatus,
} from "../types";

interface DEXConfig {
  dexscreenerApi: string;
  birdeyeApi: string;
  jupiterApi: string;
  raydiumApi: string;
  orcaApi: string;
}

interface DEXPool {
  dex: string;
  pairAddress: string;
  liquidityUSD: number;
  volume24h: number;
  priceUSD: number;
  priceChange24h: number;
  fee: number;
}

interface PriceData {
  currentPrice: number;
  priceChange24h: number;
  priceChange7d: number;
  high24h: number;
  low24h: number;
  marketCap: number;
  fullyDilutedValue: number;
}

export class DEXService {
  private config: DEXConfig;

  constructor() {
    this.config = {
      dexscreenerApi: "https://api.dexscreener.com/latest",
      birdeyeApi: "https://public-api.birdeye.so/public",
      jupiterApi: "https://quote-api.jup.ag/v6",
      raydiumApi: "https://api.raydium.io/v2",
      orcaApi: "https://api.orca.so",
    };
  }

  /**
   * Comprehensive DEX analysis for a token
   */
  async analyzeDEXData(tokenAddress: string): Promise<{
    liquidity: LiquidityAnalysis;
    volume: VolumeAnalysis;
    rugPullRisk: RugPullRisk;
    lockStatus: LockStatus;
    priceData: PriceData;
    pools: DEXPool[];
    volumeLiquidityAnalysis?: {
      ratio: number;
      context: "LEGITIMATE" | "SUSPICIOUS" | "NORMAL";
      confidence: number;
      explanation: string;
      factors: string[];
    };
  } | null> {
    try {
      console.log(`🔍 Comprehensive DEX analysis for: ${tokenAddress}`);

      const [liquidityData, volumeData, priceData, pools, lockStatus] =
        await Promise.allSettled([
          this.getLiquidityData(tokenAddress),
          this.getVolumeAnalysis(tokenAddress),
          this.getPriceData(tokenAddress),
          this.getDEXPools(tokenAddress),
          this.checkLiquidityLocks(tokenAddress),
        ]);

      const liquidity =
        liquidityData.status === "fulfilled" ? liquidityData.value : null;
      const volume =
        volumeData.status === "fulfilled" ? volumeData.value : null;
      const price = priceData.status === "fulfilled" ? priceData.value : null;
      const poolData = pools.status === "fulfilled" ? pools.value : [];
      const locks = lockStatus.status === "fulfilled" ? lockStatus.value : null;

      if (!liquidity && !volume && !price) {
        console.log("⚠️ No DEX data available");
        return null;
      }

      const rugPullRisk = this.calculateRugPullRisk(
        liquidity,
        volume,
        poolData
      );
      const enhancedLiquidity = this.enhanceLiquidityAnalysis(
        liquidity,
        poolData
      );
      const enhancedVolume = this.enhanceVolumeAnalysis(volume, poolData);

      // NEW: Enhanced volume-to-liquidity analysis
      const volumeLiquidityAnalysis = this.analyzeVolumeLiquidityPattern(
        enhancedVolume,
        enhancedLiquidity,
        poolData
      );

      // Log the enhanced analysis
      console.log(`📊 Volume-to-Liquidity Analysis:`);
      console.log(`   Ratio: ${volumeLiquidityAnalysis.ratio.toFixed(2)}x`);
      console.log(`   Context: ${volumeLiquidityAnalysis.context}`);
      console.log(`   Confidence: ${volumeLiquidityAnalysis.confidence}%`);
      console.log(`   Explanation: ${volumeLiquidityAnalysis.explanation}`);

      return {
        liquidity: enhancedLiquidity,
        volume: enhancedVolume,
        rugPullRisk,
        lockStatus: locks || {
          isLocked: false,
          lockPercentage: 0,
          lockDuration: 0,
          lockProvider: "Unknown",
          lockAddress: "",
        },
        priceData: price || {
          currentPrice: 0,
          priceChange24h: 0,
          priceChange7d: 0,
          high24h: 0,
          low24h: 0,
          marketCap: 0,
          fullyDilutedValue: 0,
        },
        pools: poolData,
        volumeLiquidityAnalysis, // NEW: Include enhanced analysis
      };
    } catch (error) {
      console.error("❌ Error in comprehensive DEX analysis:", error);
      return null;
    }
  }

  /**
   * Get token liquidity data from multiple sources
   */
  async getLiquidityData(
    tokenAddress: string
  ): Promise<LiquidityAnalysis | null> {
    try {
      console.log(`💧 Fetching liquidity data for: ${tokenAddress}`);

      // Try DexScreener first
      const dexScreenerData = await this.getDexScreenerLiquidity(tokenAddress);
      if (dexScreenerData) return dexScreenerData;

      // Fallback to Birdeye
      const birdeyeData = await this.getBirdeyeLiquidity(tokenAddress);
      if (birdeyeData) return birdeyeData;

      return null;
    } catch (error) {
      console.error("❌ Error fetching liquidity data:", error);
      return null;
    }
  }

  /**
   * Get liquidity data from DexScreener
   */
  private async getDexScreenerLiquidity(
    tokenAddress: string
  ): Promise<LiquidityAnalysis | null> {
    try {
      const response = await axios.get(
        `${this.config.dexscreenerApi}/dex/tokens/${tokenAddress}`
      );

      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];

        return {
          totalLiquidity: parseFloat(pair.liquidity?.usd || "0"),
          liquidityDepth: {
            low: parseFloat(pair.liquidity?.usd || "0") * 0.3,
            medium: parseFloat(pair.liquidity?.usd || "0") * 0.5,
            high: parseFloat(pair.liquidity?.usd || "0") * 0.2,
          },
          volume24h: parseFloat(pair.volume?.h24 || "0"),
          priceImpact: this.calculatePriceImpact(pair),
          poolCount: response.data.pairs.length,
          dexDistribution: this.calculateDEXDistribution(response.data.pairs),
        };
      }
      return null;
    } catch (error) {
      console.error("❌ DexScreener liquidity error:", error);
      return null;
    }
  }

  /**
   * Get liquidity data from Birdeye
   */
  private async getBirdeyeLiquidity(
    tokenAddress: string
  ): Promise<LiquidityAnalysis | null> {
    try {
      // Try the correct Birdeye endpoint
      const response = await axios.get(
        `${this.config.birdeyeApi}/token_list?address=${tokenAddress}`,
        { timeout: 10000 }
      );

      if (response.data?.data && response.data.data.length > 0) {
        const token = response.data.data[0];

        return {
          totalLiquidity: parseFloat(token.liquidity || "0"),
          liquidityDepth: {
            low: parseFloat(token.liquidity || "0") * 0.3,
            medium: parseFloat(token.liquidity || "0") * 0.5,
            high: parseFloat(token.liquidity || "0") * 0.2,
          },
          volume24h: parseFloat(token.volume24h || "0"),
          priceImpact: 0.1, // Default value
          poolCount: 1,
          dexDistribution: { Birdeye: 100 },
        };
      }
      return null;
    } catch (error) {
      console.log(
        "⚠️ Birdeye liquidity unavailable, trying alternative endpoint..."
      );

      // Try alternative Birdeye endpoint
      try {
        const altResponse = await axios.get(
          `https://public-api.birdeye.so/public/token_list?address=${tokenAddress}`,
          { timeout: 10000 }
        );

        if (altResponse.data?.data && altResponse.data.data.length > 0) {
          const token = altResponse.data.data[0];

          return {
            totalLiquidity: parseFloat(token.liquidity || "0"),
            liquidityDepth: {
              low: parseFloat(token.liquidity || "0") * 0.3,
              medium: parseFloat(token.liquidity || "0") * 0.5,
              high: parseFloat(token.liquidity || "0") * 0.2,
            },
            volume24h: parseFloat(token.volume24h || "0"),
            priceImpact: 0.1,
            poolCount: 1,
            dexDistribution: { Birdeye: 100 },
          };
        }
      } catch (altError) {
        console.log("⚠️ Alternative Birdeye endpoint also failed");
      }

      return null;
    }
  }

  /**
   * Get volume analysis from multiple sources
   */
  async getVolumeAnalysis(
    tokenAddress: string
  ): Promise<VolumeAnalysis | null> {
    try {
      console.log(`📈 Fetching volume data for: ${tokenAddress}`);

      const [dexScreenerVolume, birdeyeVolume] = await Promise.allSettled([
        this.getDexScreenerVolume(tokenAddress),
        this.getBirdeyeVolume(tokenAddress),
      ]);

      const volume =
        dexScreenerVolume.status === "fulfilled"
          ? dexScreenerVolume.value
          : birdeyeVolume.status === "fulfilled"
            ? birdeyeVolume.value
            : null;

      if (volume) {
        console.log(
          `📊 Volume analysis: $${volume.volume24h.toLocaleString()} USD (24h)`
        );
      }

      return volume;
    } catch (error) {
      console.error("❌ Error fetching volume data:", error);
      return null;
    }
  }

  /**
   * Get volume data from DexScreener
   */
  private async getDexScreenerVolume(
    tokenAddress: string
  ): Promise<VolumeAnalysis | null> {
    try {
      const response = await axios.get(
        `${this.config.dexscreenerApi}/dex/tokens/${tokenAddress}`
      );

      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];

        return {
          volume24h: parseFloat(pair.volume?.h24 || "0"),
          volume7d: parseFloat(pair.volume?.h7d || "0"),
          volumeChange24h: parseFloat(pair.volumeChange?.h24 || "0"),
          volumeChange7d: parseFloat(pair.volumeChange?.h7d || "0"),
          averageTradeSize:
            parseFloat(pair.volume?.h24 || "0") /
            (parseInt(pair.txns?.h24 || "1") || 1),
          volumePatterns: this.analyzeVolumePatterns(pair),
        };
      }
      return null;
    } catch (error) {
      console.error("❌ DexScreener volume error:", error);
      return null;
    }
  }

  /**
   * Get volume data from Birdeye
   */
  private async getBirdeyeVolume(
    tokenAddress: string
  ): Promise<VolumeAnalysis | null> {
    try {
      const response = await axios.get(
        `${this.config.birdeyeApi}/token_list?address=${tokenAddress}`,
        { timeout: 10000 }
      );

      if (response.data?.data && response.data.data.length > 0) {
        const token = response.data.data[0];

        return {
          volume24h: parseFloat(token.volume24h || "0"),
          volume7d: parseFloat(token.volume7d || "0"),
          volumeChange24h: parseFloat(token.volumeChange24h || "0"),
          volumeChange7d: parseFloat(token.volumeChange7d || "0"),
          averageTradeSize:
            parseFloat(token.volume24h || "0") /
            (parseInt(token.txns24h || "1") || 1),
          volumePatterns: ["Birdeye data"],
        };
      }
      return null;
    } catch (error) {
      console.log("⚠️ Birdeye volume unavailable");
      return null;
    }
  }

  /**
   * Get price data from multiple sources
   */
  async getPriceData(tokenAddress: string): Promise<PriceData | null> {
    try {
      console.log(`💰 Fetching price data for: ${tokenAddress}`);

      const [dexScreenerPrice, birdeyePrice] = await Promise.allSettled([
        this.getDexScreenerPrice(tokenAddress),
        this.getBirdeyePrice(tokenAddress),
      ]);

      return dexScreenerPrice.status === "fulfilled"
        ? dexScreenerPrice.value
        : birdeyePrice.status === "fulfilled"
          ? birdeyePrice.value
          : null;
    } catch (error) {
      console.error("❌ Error fetching price data:", error);
      return null;
    }
  }

  /**
   * Get price data from DexScreener
   */
  private async getDexScreenerPrice(
    tokenAddress: string
  ): Promise<PriceData | null> {
    try {
      const response = await axios.get(
        `${this.config.dexscreenerApi}/dex/tokens/${tokenAddress}`
      );

      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];

        return {
          currentPrice: parseFloat(pair.priceUsd || "0"),
          priceChange24h: parseFloat(pair.priceChange?.h24 || "0"),
          priceChange7d: parseFloat(pair.priceChange?.h7d || "0"),
          high24h: parseFloat(pair.priceChange?.h24High || "0"),
          low24h: parseFloat(pair.priceChange?.h24Low || "0"),
          marketCap: parseFloat(pair.marketCap || "0"),
          fullyDilutedValue: parseFloat(pair.fdv || "0"),
        };
      }
      return null;
    } catch (error) {
      console.error("❌ DexScreener price error:", error);
      return null;
    }
  }

  /**
   * Get price data from Birdeye
   */
  private async getBirdeyePrice(
    tokenAddress: string
  ): Promise<PriceData | null> {
    try {
      const response = await axios.get(
        `${this.config.birdeyeApi}/token_list?address=${tokenAddress}`,
        { timeout: 10000 }
      );

      if (response.data?.data && response.data.data.length > 0) {
        const token = response.data.data[0];

        return {
          currentPrice: parseFloat(token.price || "0"),
          priceChange24h: parseFloat(token.priceChange24h || "0"),
          priceChange7d: parseFloat(token.priceChange7d || "0"),
          high24h: parseFloat(token.high24h || "0"),
          low24h: parseFloat(token.low24h || "0"),
          marketCap: parseFloat(token.marketCap || "0"),
          fullyDilutedValue: parseFloat(token.fdv || "0"),
        };
      }
      return null;
    } catch (error) {
      console.log("⚠️ Birdeye price unavailable");
      return null;
    }
  }

  /**
   * Get DEX pools information
   */
  async getDEXPools(tokenAddress: string): Promise<DEXPool[]> {
    try {
      console.log(`🏊 Fetching DEX pools for: ${tokenAddress}`);

      const response = await axios.get(
        `${this.config.dexscreenerApi}/dex/tokens/${tokenAddress}`
      );

      if (response.data?.pairs) {
        return response.data.pairs.map((pair: any) => ({
          dex: pair.dexId,
          pairAddress: pair.pairAddress,
          liquidityUSD: parseFloat(pair.liquidity?.usd || "0"),
          volume24h: parseFloat(pair.volume?.h24 || "0"),
          priceUSD: parseFloat(pair.priceUsd || "0"),
          priceChange24h: parseFloat(pair.priceChange?.h24 || "0"),
          fee: parseFloat(pair.fee || "0"),
        }));
      }
      return [];
    } catch (error) {
      console.error("❌ Error fetching DEX pools:", error);
      return [];
    }
  }

  /**
   * Check liquidity locks (placeholder for future implementation)
   */
  async checkLiquidityLocks(tokenAddress: string): Promise<LockStatus | null> {
    try {
      console.log(`🔒 Checking liquidity locks for: ${tokenAddress}`);

      // This would require integration with specific DEX APIs
      // For now, return a placeholder
      return {
        isLocked: false,
        lockPercentage: 0,
        lockDuration: 0,
        lockProvider: "Unknown",
        lockAddress: "",
      };
    } catch (error) {
      console.error("❌ Error checking liquidity locks:", error);
      return null;
    }
  }

  /**
   * Calculate rug pull risk based on comprehensive data
   */
  private calculateRugPullRisk(
    liquidity: LiquidityAnalysis | null,
    volume: VolumeAnalysis | null,
    pools: DEXPool[]
  ): RugPullRisk {
    const indicators: string[] = [];
    let confidence = 0;

    if (liquidity) {
      if (liquidity.totalLiquidity < 10000) {
        indicators.push("Very low liquidity");
        confidence += 30;
      }
      if (liquidity.totalLiquidity < 50000) {
        indicators.push("Low liquidity");
        confidence += 20;
      }
    }

    if (volume) {
      if (volume.volume24h > (liquidity?.totalLiquidity || 0) * 5) {
        indicators.push("High volume relative to liquidity");
        confidence += 25;
      }
      if (volume.volumeChange24h > 500) {
        indicators.push("Suspicious volume spike");
        confidence += 20;
      }
    }

    if (pools.length === 0) {
      indicators.push("No DEX pools found");
      confidence += 40;
    }

    if (pools.length === 1 && pools[0].liquidityUSD < 10000) {
      indicators.push("Single low-liquidity pool");
      confidence += 25;
    }

    return {
      detected: confidence > 50,
      confidence: Math.min(confidence, 100),
      indicators,
      lastLiquidityChange: Date.now(),
      liquidityRemovalRate: 0,
    };
  }

  /**
   * Analyze volume-to-liquidity patterns with contextual intelligence
   */
  private analyzeVolumeLiquidityPattern(
    volume: VolumeAnalysis | null,
    liquidity: LiquidityAnalysis | null,
    pools: DEXPool[],
    tokenMetadata?: any
  ): {
    ratio: number;
    context: "LEGITIMATE" | "SUSPICIOUS" | "NORMAL";
    confidence: number;
    explanation: string;
    factors: string[];
  } {
    if (!volume || !liquidity || liquidity.totalLiquidity === 0) {
      return {
        ratio: 0,
        context: "NORMAL",
        confidence: 0,
        explanation: "Insufficient data for analysis",
        factors: ["No volume or liquidity data available"],
      };
    }

    const ratio = volume.volume24h / liquidity.totalLiquidity;
    const factors: string[] = [];
    let context: "LEGITIMATE" | "SUSPICIOUS" | "NORMAL" = "NORMAL";
    let confidence = 0;
    let explanation = "";

    // Factor 1: Ratio magnitude
    if (ratio > 10) {
      factors.push("Extremely high volume-to-liquidity ratio (>10x)");
      confidence += 30;
    } else if (ratio > 5) {
      factors.push("High volume-to-liquidity ratio (>5x)");
      confidence += 20;
    } else if (ratio > 2) {
      factors.push("Moderate volume-to-liquidity ratio (>2x)");
      confidence += 10;
    }

    // Factor 2: Number of DEX pools (more pools = more legitimate)
    if (pools.length >= 5) {
      factors.push("Multiple DEX pools present (legitimate indicator)");
      confidence -= 15;
    } else if (pools.length === 1) {
      factors.push("Single DEX pool (higher risk)");
      confidence += 15;
    }

    // Factor 3: Liquidity amount (higher liquidity = more legitimate)
    if (liquidity.totalLiquidity > 1000000) {
      factors.push("High liquidity (>$1M) - legitimate indicator");
      confidence -= 20;
    } else if (liquidity.totalLiquidity < 50000) {
      factors.push("Low liquidity (<$50K) - higher risk");
      confidence += 20;
    }

    // Factor 4: Volume consistency (check if volume is stable)
    if (volume.volumeChange24h > 200) {
      factors.push("Suspicious volume spike (>200% change)");
      confidence += 25;
    } else if (volume.volumeChange24h < -80) {
      factors.push("Volume crash (>80% decrease)");
      confidence += 20;
    }

    // Factor 5: Token type context (if available)
    if (tokenMetadata) {
      const tokenName = tokenMetadata.name?.toLowerCase() || "";
      const tokenSymbol = tokenMetadata.symbol?.toLowerCase() || "";

      // Known legitimate tokens that often have high volume-to-liquidity ratios
      const legitimateHighVolumeTokens = [
        "wrapped sol",
        "wsol",
        "sol",
        "usdc",
        "usdt",
        "dai",
        "jup",
        "jupiter",
        "ray",
        "raydium",
        "orca",
        "orca token",
      ];

      if (
        legitimateHighVolumeTokens.some(
          (token) => tokenName.includes(token) || tokenSymbol.includes(token)
        )
      ) {
        factors.push("Known legitimate token with expected high volume");
        confidence -= 30;
        context = "LEGITIMATE";
      }
    }

    // Determine final context based on confidence
    if (confidence >= 50) {
      context = "SUSPICIOUS";
      explanation = "High confidence of suspicious trading patterns detected";
    } else if (confidence <= 20) {
      context = "LEGITIMATE";
      explanation = "Patterns consistent with legitimate trading activity";
    } else {
      context = "NORMAL";
      explanation = "Mixed indicators - moderate risk level";
    }

    return {
      ratio,
      context,
      confidence: Math.min(Math.max(confidence, 0), 100),
      explanation,
      factors,
    };
  }

  /**
   * Enhance liquidity analysis with pool data
   */
  private enhanceLiquidityAnalysis(
    liquidity: LiquidityAnalysis | null,
    pools: DEXPool[]
  ): LiquidityAnalysis {
    if (!liquidity) {
      return {
        totalLiquidity: 0,
        liquidityDepth: { low: 0, medium: 0, high: 0 },
        volume24h: 0,
        priceImpact: 0,
        poolCount: pools.length,
        dexDistribution: {},
      };
    }

    return {
      ...liquidity,
      poolCount: pools.length,
      dexDistribution: this.calculateDEXDistribution(pools),
    };
  }

  /**
   * Enhance volume analysis with pool data
   */
  private enhanceVolumeAnalysis(
    volume: VolumeAnalysis | null,
    pools: DEXPool[]
  ): VolumeAnalysis {
    if (!volume) {
      return {
        volume24h: 0,
        volume7d: 0,
        volumeChange24h: 0,
        volumeChange7d: 0,
        averageTradeSize: 0,
        volumePatterns: [],
      };
    }

    return volume;
  }

  /**
   * Calculate price impact
   */
  private calculatePriceImpact(pair: any): number {
    const liquidityUSD = parseFloat(pair.liquidity?.usd || "0");
    if (liquidityUSD === 0) return 100;

    // Simple price impact calculation
    return Math.min(100, (10000 / liquidityUSD) * 100);
  }

  /**
   * Calculate DEX distribution
   */
  private calculateDEXDistribution(pairs: any[]): { [dex: string]: number } {
    const distribution: { [dex: string]: number } = {};

    pairs.forEach((pair) => {
      const dex = pair.dexId || pair.dex;
      const liquidity = parseFloat(pair.liquidity?.usd || "0");
      distribution[dex] = (distribution[dex] || 0) + liquidity;
    });

    return distribution;
  }

  /**
   * Analyze volume patterns
   */
  private analyzeVolumePatterns(pair: any): string[] {
    const patterns: string[] = [];
    const priceChange = parseFloat(pair.priceChange?.h24 || "0");
    const volumeChange = parseFloat(pair.volumeChange?.h24 || "0");

    if (priceChange > 20 && volumeChange > 100) patterns.push("PUMP");
    if (priceChange < -20 && volumeChange > 100) patterns.push("DUMP");
    if (volumeChange > 500) patterns.push("MANIPULATION");
    if (volumeChange < -50) patterns.push("VOLUME_DROP");

    return patterns;
  }
}

export default DEXService;
