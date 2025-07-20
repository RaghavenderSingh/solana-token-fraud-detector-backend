import axios from "axios";

interface HolderAnalysis {
  totalHolders: number;
  topHolders: Array<{
    address: string;
    balance: number;
    percentage: number;
  }>;
  concentration: {
    top10: number;
    top50: number;
    top100: number;
  };
  distributionRisk: "LOW" | "MEDIUM" | "HIGH";
  riskFactors: string[];
}

interface WalletProfile {
  address: string;
  tokenCount: number;
  totalValue: number;
  activityLevel: "LOW" | "MEDIUM" | "HIGH";
  suspiciousActivity: boolean;
  riskScore: number;
}

export class HolderService {
  private heliusApiKey: string;

  constructor(heliusApiKey: string) {
    this.heliusApiKey = heliusApiKey;
  }

  /**
   * Analyze token holder distribution
   */
  async analyzeHolderDistribution(
    tokenAddress: string
  ): Promise<HolderAnalysis | null> {
    try {
      console.log(`👥 Analyzing holder distribution for: ${tokenAddress}`);

      // Get largest accounts using Helius
      const response = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenLargestAccounts",
          params: [tokenAddress],
        }
      );

      if (response.data?.result?.value) {
        const accounts = response.data.result.value;
        const totalSupply = await this.getTokenSupply(tokenAddress);

        const topHolders = accounts.map((account: any) => ({
          address: account.address,
          balance: parseInt(account.amount),
          percentage: (parseInt(account.amount) / totalSupply) * 100,
        }));

        const concentration = this.calculateConcentration(topHolders);
        const distributionRisk = this.assessDistributionRisk(concentration);
        const riskFactors = this.identifyHolderRiskFactors(
          concentration,
          topHolders
        );

        const analysis: HolderAnalysis = {
          totalHolders: await this.getTotalHolders(tokenAddress),
          topHolders,
          concentration,
          distributionRisk,
          riskFactors,
        };

        console.log(
          `📊 Holder analysis: ${analysis.totalHolders} holders, ${concentration.top10.toFixed(2)}% in top 10`
        );
        return analysis;
      }

      return null;
    } catch (error) {
      console.error("❌ Error analyzing holder distribution:", error);
      return null;
    }
  }

  /**
   * Analyze individual wallet behavior
   */
  async analyzeWallet(walletAddress: string): Promise<WalletProfile | null> {
    try {
      console.log(`🔍 Analyzing wallet: ${walletAddress}`);

      // Get wallet token holdings
      const response = await axios.get(
        `https://api.helius.xyz/v0/addresses/${walletAddress}/balances`,
        {
          params: {
            "api-key": this.heliusApiKey,
          },
        }
      );

      if (response.data?.tokens) {
        const tokens = response.data.tokens;
        const totalValue = tokens.reduce(
          (sum: number, token: any) => sum + (token.value || 0),
          0
        );

        const profile: WalletProfile = {
          address: walletAddress,
          tokenCount: tokens.length,
          totalValue,
          activityLevel: this.calculateActivityLevel(tokens),
          suspiciousActivity: this.detectSuspiciousActivity(tokens),
          riskScore: this.calculateWalletRiskScore(tokens),
        };

        console.log(
          `📊 Wallet analysis: ${tokens.length} tokens, $${totalValue.toFixed(2)} value`
        );
        return profile;
      }

      return null;
    } catch (error) {
      console.error("❌ Error analyzing wallet:", error);
      return null;
    }
  }

  /**
   * Detect coordinated activity between wallets
   */
  async detectCoordinatedActivity(wallets: string[]): Promise<{
    coordinated: boolean;
    confidence: number;
    patterns: string[];
  }> {
    try {
      console.log(
        `🔍 Detecting coordinated activity among ${wallets.length} wallets`
      );

      // This would require more sophisticated analysis
      // For now, return a basic assessment
      const patterns: string[] = [];
      let coordinated = false;
      let confidence = 0;

      // Placeholder logic - in real implementation, you'd analyze:
      // - Similar transaction timing
      // - Similar token holdings
      // - Similar trading patterns
      // - Common funding sources

      return {
        coordinated,
        confidence,
        patterns,
      };
    } catch (error) {
      console.error("❌ Error detecting coordinated activity:", error);
      return {
        coordinated: false,
        confidence: 0,
        patterns: [],
      };
    }
  }

  /**
   * Get token total supply
   */
  private async getTokenSupply(tokenAddress: string): Promise<number> {
    try {
      const response = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenSupply",
          params: [tokenAddress],
        }
      );

      return parseInt(response.data?.result?.value?.amount || "0");
    } catch (error) {
      console.error("❌ Error getting token supply:", error);
      return 0;
    }
  }

  /**
   * Get total number of holders (approximate)
   */
  private async getTotalHolders(tokenAddress: string): Promise<number> {
    try {
      // This would require additional API calls to get exact count
      // For now, return an estimate based on largest accounts
      return 1000; // Placeholder
    } catch (error) {
      console.error("❌ Error getting total holders:", error);
      return 0;
    }
  }

  /**
   * Calculate concentration percentages
   */
  private calculateConcentration(topHolders: Array<{ percentage: number }>): {
    top10: number;
    top50: number;
    top100: number;
  } {
    const top10 = topHolders
      .slice(0, 10)
      .reduce((sum, holder) => sum + holder.percentage, 0);
    const top50 = topHolders
      .slice(0, 50)
      .reduce((sum, holder) => sum + holder.percentage, 0);
    const top100 = topHolders
      .slice(0, 100)
      .reduce((sum, holder) => sum + holder.percentage, 0);

    return { top10, top50, top100 };
  }

  /**
   * Assess distribution risk
   */
  private assessDistributionRisk(concentration: {
    top10: number;
    top50: number;
    top100: number;
  }): "LOW" | "MEDIUM" | "HIGH" {
    if (concentration.top10 > 80) return "HIGH";
    if (concentration.top10 > 60) return "MEDIUM";
    return "LOW";
  }

  /**
   * Identify holder-related risk factors
   */
  private identifyHolderRiskFactors(
    concentration: { top10: number; top50: number; top100: number },
    topHolders: Array<{ percentage: number }>
  ): string[] {
    const factors: string[] = [];

    if (concentration.top10 > 80) {
      factors.push("Extreme concentration in top 10 holders");
    }

    if (concentration.top10 > 60) {
      factors.push("High concentration in top 10 holders");
    }

    if (topHolders[0]?.percentage > 50) {
      factors.push("Single holder owns majority of tokens");
    }

    return factors;
  }

  /**
   * Calculate wallet activity level
   */
  private calculateActivityLevel(tokens: any[]): "LOW" | "MEDIUM" | "HIGH" {
    const activeTokens = tokens.filter((token: any) => token.value > 0).length;

    if (activeTokens > 20) return "HIGH";
    if (activeTokens > 10) return "MEDIUM";
    return "LOW";
  }

  /**
   * Detect suspicious wallet activity
   */
  private detectSuspiciousActivity(tokens: any[]): boolean {
    // Check for patterns that might indicate bot or scammer activity
    const suspiciousPatterns = [
      tokens.length > 50, // Too many tokens
      tokens.some((token: any) => token.value > 1000000), // Very high value
      tokens.filter((token: any) => token.value < 1).length > 20, // Many dust tokens
    ];

    return suspiciousPatterns.some((pattern) => pattern);
  }

  /**
   * Calculate wallet risk score
   */
  private calculateWalletRiskScore(tokens: any[]): number {
    let score = 0;

    // Add points for suspicious patterns
    if (tokens.length > 50) score += 30;
    if (tokens.some((token: any) => token.value > 1000000)) score += 20;
    if (tokens.filter((token: any) => token.value < 1).length > 20) score += 25;

    return Math.min(score, 100);
  }
}

export default HolderService;
