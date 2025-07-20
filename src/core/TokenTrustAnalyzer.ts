import axios from "axios";
import {
  TokenAnalysis,
  TokenMetadata,
  MintInfo,
  TransactionAnalysis,
  CreatorAnalysis,
  RiskFactors,
  WhitelistInfo,
  TransactionData,
} from "../types";
import { DEXService } from "../services/dexService";
import { HolderService } from "../services/holderService";

// Whitelist of known safe tokens (even with active authorities)
const KNOWN_SAFE_TOKENS: Record<string, WhitelistInfo> = {
  So11111111111111111111111111111111111111112: {
    name: "Wrapped SOL",
    symbol: "SOL",
    reason: "Native SOL wrapper - official Solana token",
    riskOverride: "LOW",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    name: "USD Coin",
    symbol: "USDC",
    reason: "Circle-issued regulated stablecoin",
    riskOverride: "LOW",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    name: "Tether USD",
    symbol: "USDT",
    reason: "Tether-issued regulated stablecoin",
    riskOverride: "LOW",
  },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {
    name: "Bonk",
    symbol: "BONK",
    reason: "Established community meme token",
    riskOverride: "LOW",
  },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
    name: "Jupiter",
    symbol: "JUP",
    reason: "Jupiter DEX governance token",
    riskOverride: "LOW",
  },
};

export class TokenTrustAnalyzer {
  private apiKey: string;
  private rpcBase: string;
  private riskWeights: RiskFactors;
  private dexService: DEXService;
  private holderService: HolderService;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.rpcBase = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    this.dexService = new DEXService();
    this.holderService = new HolderService(apiKey);
    this.riskWeights = {
      MINT_AUTHORITY: 30,
      FREEZE_AUTHORITY: 25,
      TOKEN_AGE: 20,
      TRANSACTION_VOLUME: 15,
      CREATOR_BEHAVIOR: 15,
      METADATA_QUALITY: 10,
      LIQUIDITY_RISK: 25,
      HOLDER_CONCENTRATION: 20,
    };
  }

  /**
   * Main analysis function with improved logic
   */
  async analyzeToken(tokenAddress: string): Promise<TokenAnalysis> {
    console.log(`\n🚀 TOKENTRUST ANALYSIS: ${tokenAddress}`);
    console.log("=".repeat(70));

    const analysis: TokenAnalysis = {
      tokenAddress,
      timestamp: new Date().toISOString(),
      tokenInfo: null,
      mintInfo: null,
      transactionData: null,
      creatorData: null,
      isWhitelisted: false,
      whitelistInfo: null,
      riskScore: 0,
      riskLevel: "LOW",
      riskFactors: [],
      safetyFactors: [],
      recommendations: [],
    };

    // Check if token is whitelisted first
    if (KNOWN_SAFE_TOKENS[tokenAddress]) {
      analysis.isWhitelisted = true;
      analysis.whitelistInfo = KNOWN_SAFE_TOKENS[tokenAddress];
      console.log(`\n✅ WHITELISTED TOKEN: ${analysis.whitelistInfo.name}`);
      console.log(`   Reason: ${analysis.whitelistInfo.reason}`);
    }

    try {
      // Step 1: Get token metadata
      console.log("\n📄 Step 1: Fetching token metadata...");
      analysis.tokenInfo = await this.getTokenMetadata(tokenAddress);

      // Step 2: Get mint info
      console.log("\n🔧 Step 2: Checking mint authorities...");
      analysis.mintInfo = await this.getMintInfo(tokenAddress);

      // Step 3: Analyze transactions with improved time calculation
      console.log("\n📊 Step 3: Analyzing transaction patterns...");
      analysis.transactionData = await this.analyzeTransactions(tokenAddress);

      // Step 4: Creator analysis
      console.log("\n👤 Step 4: Analyzing creator behavior...");
      analysis.creatorData = await this.analyzeCreator(
        analysis.transactionData
      );

      // Step 5: Calculate risk with whitelist consideration
      console.log("\n⚠️ Step 5: Calculating risk assessment...");
      this.calculateImprovedRiskScore(analysis);

      console.log("\n✅ Analysis complete!");
      this.printDetailedSummary(analysis);

      return analysis;
    } catch (error) {
      console.error(
        "❌ Analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      analysis.riskFactors.push("Technical analysis failed");
      analysis.riskScore = analysis.isWhitelisted ? 20 : 75;
      analysis.riskLevel = analysis.isWhitelisted ? "LOW" : "HIGH";
      return analysis;
    }
  }

  /**
   * Get token metadata using DAS
   */
  private async getTokenMetadata(
    tokenAddress: string
  ): Promise<TokenMetadata | null> {
    try {
      const response = await axios.post(this.rpcBase, {
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: tokenAddress },
      });

      const result = response.data?.result;
      if (!result) {
        console.log("   ⚠️ No metadata found");
        return null;
      }

      const tokenInfo: TokenMetadata = {
        address: tokenAddress,
        name: result.content?.metadata?.name || "Unknown",
        symbol: result.content?.metadata?.symbol || "Unknown",
        image: result.content?.links?.image || undefined,
        supply: result.token_info?.supply || "0",
        decimals: result.token_info?.decimals || 0,
        priceInfo: result.token_info?.price_info || undefined,
        interface: result.interface || "Unknown",
        mutable: result.mutable || false,
      };

      console.log(`   ✅ Found: ${tokenInfo.name} (${tokenInfo.symbol})`);
      if (tokenInfo.priceInfo) {
        console.log(
          `   💰 Price: $${tokenInfo.priceInfo.price_per_token} ${tokenInfo.priceInfo.currency}`
        );
      }

      return tokenInfo;
    } catch (error) {
      console.log("   ❌ Metadata fetch failed");
      return null;
    }
  }

  /**
   * Get mint authority info
   */
  private async getMintInfo(tokenAddress: string): Promise<MintInfo | null> {
    try {
      const response = await axios.post(this.rpcBase, {
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [tokenAddress, { encoding: "jsonParsed" }],
      });

      const accountInfo = response.data?.result?.value;
      if (!accountInfo?.data?.parsed) {
        console.log("   ⚠️ Not a valid SPL token");
        return null;
      }

      const mintData = accountInfo.data.parsed.info;
      const mintRevoked =
        !mintData.mintAuthority ||
        mintData.mintAuthority === "11111111111111111111111111111111";
      const freezeRevoked =
        !mintData.freezeAuthority ||
        mintData.freezeAuthority === "11111111111111111111111111111111";

      console.log(
        `   🔑 Mint Authority: ${mintRevoked ? "✅ Revoked" : "❌ Active"}`
      );
      console.log(
        `   🧊 Freeze Authority: ${freezeRevoked ? "✅ Revoked" : "❌ Active"}`
      );

      const actualSupply =
        parseInt(mintData.supply) / Math.pow(10, mintData.decimals);
      console.log(`   📊 Supply: ${actualSupply.toLocaleString()}`);

      return {
        decimals: mintData.decimals,
        supply: mintData.supply,
        actualSupply,
        mintAuthority: mintData.mintAuthority,
        freezeAuthority: mintData.freezeAuthority,
        mintRevoked,
        freezeRevoked,
      };
    } catch (error) {
      console.log("   ❌ Mint info fetch failed");
      return null;
    }
  }

  /**
   * Analyze transaction patterns
   */
  private async analyzeTransactions(
    tokenAddress: string,
    limit: number = 100
  ): Promise<TransactionAnalysis | null> {
    try {
      const response = await axios.post(this.rpcBase, {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [tokenAddress, { limit }],
      });

      const transactions = response.data?.result || [];
      if (transactions.length === 0) {
        console.log("   ⚠️ No transactions found");
        return this.getEmptyTransactionAnalysis();
      }

      console.log(`   📊 Found ${transactions.length} transactions`);

      // Get enhanced transaction data
      const signatures = transactions.map((tx: any) => tx.signature);
      const enhancedTxs = await this.getEnhancedTransactions(signatures);

      const analysis: TransactionAnalysis = {
        totalTransactions: transactions.length,
        timeSpan: this.calculateImprovedTimeSpan(transactions),
        transferPatterns: this.analyzeTransferPatterns(enhancedTxs),
        accountActivity: this.analyzeAccountActivity(enhancedTxs),
        suspiciousActivity: this.detectSuspiciousActivity(enhancedTxs),
      };

      return analysis;
    } catch (error) {
      console.log("   ❌ Transaction analysis failed");
      return this.getEmptyTransactionAnalysis();
    }
  }

  /**
   * Get enhanced transaction data
   */
  private async getEnhancedTransactions(
    signatures: string[]
  ): Promise<TransactionData[]> {
    try {
      const response = await axios.post(
        `https://api.helius.xyz/v0/transactions`,
        {
          transactions: signatures,
        },
        {
          params: { "api-key": this.apiKey },
        }
      );

      return response.data || [];
    } catch (error) {
      console.log("   ⚠️ Enhanced transaction data unavailable");
      return [];
    }
  }

  /**
   * Calculate time span from transactions
   */
  private calculateImprovedTimeSpan(transactions: any[]): {
    firstTx: number;
    lastTx: number;
    daysActive: number;
  } {
    if (transactions.length === 0) {
      return { firstTx: 0, lastTx: 0, daysActive: 0 };
    }

    const timestamps = transactions
      .map((tx) => tx.blockTime || 0)
      .filter((t) => t > 0);
    if (timestamps.length === 0) {
      return { firstTx: 0, lastTx: 0, daysActive: 0 };
    }

    const firstTx = Math.min(...timestamps);
    const lastTx = Math.max(...timestamps);
    const daysActive = (lastTx - firstTx) / (24 * 60 * 60);

    console.log(`   📅 Token age: ${daysActive.toFixed(1)} days`);
    return { firstTx, lastTx, daysActive };
  }

  /**
   * Analyze transfer patterns
   */
  private analyzeTransferPatterns(transactions: TransactionData[]): {
    totalTransfers: number;
    uniqueSenders: number;
    uniqueReceivers: number;
    averageTransferSize: number;
  } {
    const transfers = transactions.filter(
      (tx) =>
        tx.type === "TRANSFER" ||
        (tx.tokenTransfers && tx.tokenTransfers.length > 0) ||
        (tx.nativeTransfers && tx.nativeTransfers.length > 0)
    );

    const senders = new Set<string>();
    const receivers = new Set<string>();
    let totalAmount = 0;

    transfers.forEach((tx) => {
      if (tx.tokenTransfers) {
        tx.tokenTransfers.forEach((transfer) => {
          if (transfer.fromUserAccount) senders.add(transfer.fromUserAccount);
          if (transfer.toUserAccount) receivers.add(transfer.toUserAccount);
          totalAmount += parseFloat(transfer.amount) || 0;
        });
      }
    });

    return {
      totalTransfers: transfers.length,
      uniqueSenders: senders.size,
      uniqueReceivers: receivers.size,
      averageTransferSize:
        transfers.length > 0 ? totalAmount / transfers.length : 0,
    };
  }

  /**
   * Analyze account activity
   */
  private analyzeAccountActivity(transactions: TransactionData[]): {
    activeAccounts: number;
    newAccounts: number;
    dormantAccounts: number;
  } {
    const accounts = new Set<string>();
    const activeAccounts = new Set<string>();

    transactions.forEach((tx) => {
      if (tx.accountData) {
        tx.accountData.forEach((account) => {
          accounts.add(account.account);
          activeAccounts.add(account.account);
        });
      }
    });

    return {
      activeAccounts: activeAccounts.size,
      newAccounts: Math.floor(accounts.size * 0.3), // Estimate
      dormantAccounts: Math.floor(accounts.size * 0.1), // Estimate
    };
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(transactions: TransactionData[]): {
    detected: boolean;
    patterns: string[];
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  } {
    const patterns: string[] = [];
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

    // Check for rapid transfers
    const rapidTransfers = transactions.filter(
      (tx) =>
        tx.type === "TRANSFER" &&
        tx.tokenTransfers?.some((t) => parseFloat(t.amount) > 1000)
    ).length;

    if (rapidTransfers > 10) {
      patterns.push("High volume rapid transfers detected");
      riskLevel = "HIGH";
    }

    // Check for small transfers (bot activity)
    const smallTransfers = transactions.filter(
      (tx) =>
        tx.type === "TRANSFER" &&
        tx.tokenTransfers?.some((t) => parseFloat(t.amount) < 1)
    ).length;

    if (smallTransfers > 50) {
      patterns.push("Suspicious small transfer patterns");
      riskLevel = riskLevel === "LOW" ? "MEDIUM" : "HIGH";
    }

    return {
      detected: patterns.length > 0,
      patterns,
      riskLevel,
    };
  }

  /**
   * Analyze creator behavior
   */
  private async analyzeCreator(
    transactionData: TransactionAnalysis | null
  ): Promise<CreatorAnalysis | null> {
    if (!transactionData) {
      return null;
    }

    const creatorActivity = {
      totalTransactions: transactionData.totalTransactions,
      lastActivity: transactionData.timeSpan.lastTx,
      daysSinceLastActivity:
        (Date.now() / 1000 - transactionData.timeSpan.lastTx) / (24 * 60 * 60),
    };

    const behaviorPatterns = {
      isActive: creatorActivity.daysSinceLastActivity < 7,
      hasMultipleTokens: false, // Would need additional analysis
      suspiciousPatterns: transactionData.suspiciousActivity.patterns,
    };

    const riskAssessment = {
      level: transactionData.suspiciousActivity.riskLevel,
      factors: transactionData.suspiciousActivity.patterns,
    };

    return {
      creatorActivity,
      behaviorPatterns,
      riskAssessment,
    };
  }

  /**
   * Calculate improved risk score
   */
  private calculateImprovedRiskScore(analysis: TokenAnalysis): void {
    let totalScore = 0;
    const factors: string[] = [];
    const safetyFactors: string[] = [];

    // Mint authority risk
    if (analysis.mintInfo && !analysis.mintInfo.mintRevoked) {
      totalScore += this.riskWeights.MINT_AUTHORITY;
      factors.push("Active mint authority - unlimited supply possible");
    } else if (analysis.mintInfo?.mintRevoked) {
      safetyFactors.push("Mint authority revoked - supply is fixed");
    }

    // Freeze authority risk
    if (analysis.mintInfo && !analysis.mintInfo.freezeRevoked) {
      totalScore += this.riskWeights.FREEZE_AUTHORITY;
      factors.push("Active freeze authority - accounts can be frozen");
    } else if (analysis.mintInfo?.freezeRevoked) {
      safetyFactors.push("Freeze authority revoked - accounts protected");
    }

    // Token age risk
    if (analysis.transactionData) {
      const daysActive = analysis.transactionData.timeSpan.daysActive;
      if (daysActive < 1) {
        totalScore += this.riskWeights.TOKEN_AGE;
        factors.push("Very new token - high risk");
      } else if (daysActive < 7) {
        totalScore += this.riskWeights.TOKEN_AGE * 0.7;
        factors.push("New token - moderate risk");
      } else if (daysActive > 30) {
        safetyFactors.push("Established token - lower risk");
      }
    }

    // Transaction volume risk
    if (analysis.transactionData) {
      const totalTransfers =
        analysis.transactionData.transferPatterns.totalTransfers;
      if (totalTransfers < 10) {
        totalScore += this.riskWeights.TRANSACTION_VOLUME;
        factors.push("Low transaction volume - suspicious");
      } else if (totalTransfers > 100) {
        safetyFactors.push("High transaction volume - active trading");
      }
    }

    // Creator behavior risk
    if (analysis.creatorData) {
      const riskLevel = analysis.creatorData.riskAssessment.level;
      if (riskLevel === "HIGH") {
        totalScore += this.riskWeights.CREATOR_BEHAVIOR;
        factors.push("Suspicious creator behavior detected");
      } else if (riskLevel === "LOW") {
        safetyFactors.push("Normal creator behavior patterns");
      }
    }

    // Metadata quality risk
    if (analysis.tokenInfo) {
      if (!analysis.tokenInfo.name || analysis.tokenInfo.name === "Unknown") {
        totalScore += this.riskWeights.METADATA_QUALITY;
        factors.push("Poor metadata quality");
      } else {
        safetyFactors.push("Good metadata quality");
      }
    }

    // Apply whitelist override
    if (analysis.isWhitelisted && analysis.whitelistInfo) {
      totalScore = Math.min(totalScore, 20); // Cap at 20 for whitelisted tokens
      safetyFactors.push(`Whitelisted token: ${analysis.whitelistInfo.reason}`);
    }

    // Determine risk level
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (totalScore >= 80) riskLevel = "CRITICAL";
    else if (totalScore >= 60) riskLevel = "HIGH";
    else if (totalScore >= 40) riskLevel = "MEDIUM";
    else riskLevel = "LOW";

    analysis.riskScore = totalScore;
    analysis.riskLevel = riskLevel;
    analysis.riskFactors = factors;
    analysis.safetyFactors = safetyFactors;
    analysis.recommendations = this.generateImprovedRecommendations(
      totalScore,
      analysis.isWhitelisted
    );
  }

  /**
   * Generate recommendations based on risk score
   */
  private generateImprovedRecommendations(
    riskScore: number,
    isWhitelisted: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (isWhitelisted) {
      recommendations.push("✅ This is a whitelisted token - generally safe");
      return recommendations;
    }

    if (riskScore >= 80) {
      recommendations.push("🚨 EXTREME RISK: Avoid this token completely");
      recommendations.push("⚠️ Multiple red flags detected");
      recommendations.push("🔍 Research thoroughly before any interaction");
    } else if (riskScore >= 60) {
      recommendations.push("⚠️ HIGH RISK: Exercise extreme caution");
      recommendations.push("💰 Only invest what you can afford to lose");
      recommendations.push("📊 Monitor for suspicious activity");
    } else if (riskScore >= 40) {
      recommendations.push("⚠️ MODERATE RISK: Proceed with caution");
      recommendations.push("🔍 Do additional research");
      recommendations.push("📈 Monitor token performance closely");
    } else {
      recommendations.push("✅ LOW RISK: Token appears safe");
      recommendations.push("📊 Standard due diligence recommended");
    }

    return recommendations;
  }

  /**
   * Print detailed analysis summary
   */
  private printDetailedSummary(analysis: TokenAnalysis): void {
    console.log("\n" + "=".repeat(70));
    console.log("📊 TOKENTRUST ANALYSIS SUMMARY");
    console.log("=".repeat(70));

    if (analysis.tokenInfo) {
      console.log(
        `\n📄 Token: ${analysis.tokenInfo.name} (${analysis.tokenInfo.symbol})`
      );
      console.log(`📍 Address: ${analysis.tokenAddress}`);
    }

    console.log(`\n⚠️ Risk Assessment:`);
    console.log(`   Score: ${analysis.riskScore}/100`);
    console.log(`   Level: ${analysis.riskLevel}`);

    if (analysis.riskFactors.length > 0) {
      console.log(`\n🚨 Risk Factors:`);
      analysis.riskFactors.forEach((factor) => console.log(`   • ${factor}`));
    }

    if (analysis.safetyFactors.length > 0) {
      console.log(`\n✅ Safety Factors:`);
      analysis.safetyFactors.forEach((factor) => console.log(`   • ${factor}`));
    }

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      analysis.recommendations.forEach((rec) => console.log(`   • ${rec}`));
    }

    console.log("\n" + "=".repeat(70));
  }

  /**
   * Get empty transaction analysis
   */
  private getEmptyTransactionAnalysis(): TransactionAnalysis {
    return {
      totalTransactions: 0,
      timeSpan: { firstTx: 0, lastTx: 0, daysActive: 0 },
      transferPatterns: {
        totalTransfers: 0,
        uniqueSenders: 0,
        uniqueReceivers: 0,
        averageTransferSize: 0,
      },
      accountActivity: {
        activeAccounts: 0,
        newAccounts: 0,
        dormantAccounts: 0,
      },
      suspiciousActivity: { detected: false, patterns: [], riskLevel: "LOW" },
    };
  }
}
