import axios from "axios";

interface DEXConfig {
  dexscreenerApi: string;
  birdeyeApi: string;
  jupiterApi: string;
}

interface LiquidityAnalysis {
  totalLiquidity: number;
  liquidityUSD: number;
  volume24h: number;
  priceChange24h: number;
  liquidityDepth: {
    buy: number;
    sell: number;
  };
  rugPullRisk: "LOW" | "MEDIUM" | "HIGH";
  riskFactors: string[];
}

interface VolumeAnalysis {
  volume24h: number;
  volume7d: number;
  volumeChange24h: number;
  averageTradeSize: number;
  volumePattern: "NORMAL" | "PUMP" | "DUMP" | "MANIPULATION";
}

export class DEXService {
  private config: DEXConfig;

  constructor() {
    this.config = {
      dexscreenerApi: "https://api.dexscreener.com/latest",
      birdeyeApi: "https://public-api.birdeye.so",
      jupiterApi: "https://quote-api.jup.ag/v6",
    };
  }

  /**
   * Get token liquidity data from DexScreener
   */
  async getLiquidityData(
    tokenAddress: string
  ): Promise<LiquidityAnalysis | null> {
    try {
      console.log(`🔍 Fetching liquidity data for: ${tokenAddress}`);

      const response = await axios.get(
        `${this.config.dexscreenerApi}/dex/tokens/${tokenAddress}`
      );

      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0]; // Get the most liquid pair

        const analysis: LiquidityAnalysis = {
          totalLiquidity: parseFloat(pair.liquidity?.usd || "0"),
          liquidityUSD: parseFloat(pair.liquidity?.usd || "0"),
          volume24h: parseFloat(pair.volume?.h24 || "0"),
          priceChange24h: parseFloat(pair.priceChange?.h24 || "0"),
          liquidityDepth: {
            buy: parseFloat(pair.liquidity?.usd || "0") * 0.5, // Estimate
            sell: parseFloat(pair.liquidity?.usd || "0") * 0.5,
          },
          rugPullRisk: this.calculateRugPullRisk(pair),
          riskFactors: this.identifyRiskFactors(pair),
        };

        console.log(
          `📊 Liquidity analysis: $${analysis.liquidityUSD.toLocaleString()} USD`
        );
        return analysis;
      }

      console.log("⚠️ No liquidity data found");
      return null;
    } catch (error) {
      console.error("❌ Error fetching liquidity data:", error);
      return null;
    }
  }

  /**
   * Get volume analysis
   */
  async getVolumeAnalysis(
    tokenAddress: string
  ): Promise<VolumeAnalysis | null> {
    try {
      console.log(`📈 Fetching volume data for: ${tokenAddress}`);

      const response = await axios.get(
        `${this.config.dexscreenerApi}/dex/tokens/${tokenAddress}`
      );

      if (response.data?.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];

        const analysis: VolumeAnalysis = {
          volume24h: parseFloat(pair.volume?.h24 || "0"),
          volume7d: parseFloat(pair.volume?.h7d || "0"),
          volumeChange24h: parseFloat(pair.volumeChange?.h24 || "0"),
          averageTradeSize:
            parseFloat(pair.volume?.h24 || "0") /
            (parseInt(pair.txns?.h24 || "1") || 1),
          volumePattern: this.analyzeVolumePattern(pair),
        };

        console.log(
          `📊 Volume analysis: $${analysis.volume24h.toLocaleString()} USD (24h)`
        );
        return analysis;
      }

      return null;
    } catch (error) {
      console.error("❌ Error fetching volume data:", error);
      return null;
    }
  }

  /**
   * Check if liquidity is locked
   */
  async checkLiquidityLocks(tokenAddress: string): Promise<boolean> {
    try {
      // This would require integration with specific DEX APIs
      // For now, return a placeholder
      console.log(`🔒 Checking liquidity locks for: ${tokenAddress}`);
      return false; // Placeholder
    } catch (error) {
      console.error("❌ Error checking liquidity locks:", error);
      return false;
    }
  }

  /**
   * Calculate rug pull risk based on liquidity data
   */
  private calculateRugPullRisk(pair: any): "LOW" | "MEDIUM" | "HIGH" {
    const liquidityUSD = parseFloat(pair.liquidity?.usd || "0");
    const volume24h = parseFloat(pair.volume?.h24 || "0");

    if (liquidityUSD < 10000) return "HIGH";
    if (liquidityUSD < 50000) return "MEDIUM";
    if (volume24h > liquidityUSD * 10) return "HIGH"; // High volume relative to liquidity

    return "LOW";
  }

  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(pair: any): string[] {
    const factors: string[] = [];
    const liquidityUSD = parseFloat(pair.liquidity?.usd || "0");
    const volume24h = parseFloat(pair.volume?.h24 || "0");

    if (liquidityUSD < 10000) {
      factors.push("Very low liquidity - high rug pull risk");
    }

    if (volume24h > liquidityUSD * 5) {
      factors.push(
        "High volume relative to liquidity - potential manipulation"
      );
    }

    if (parseFloat(pair.priceChange?.h24 || "0") > 50) {
      factors.push("Extreme price volatility - suspicious activity");
    }

    return factors;
  }

  /**
   * Analyze volume patterns
   */
  private analyzeVolumePattern(
    pair: any
  ): "NORMAL" | "PUMP" | "DUMP" | "MANIPULATION" {
    const priceChange = parseFloat(pair.priceChange?.h24 || "0");
    const volumeChange = parseFloat(pair.volumeChange?.h24 || "0");

    if (priceChange > 20 && volumeChange > 100) return "PUMP";
    if (priceChange < -20 && volumeChange > 100) return "DUMP";
    if (volumeChange > 500) return "MANIPULATION";

    return "NORMAL";
  }
}

export default DEXService;
