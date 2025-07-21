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
import { VerificationService } from "../services/verificationService";
import { SocialMediaService } from "../services/socialMediaService";

export class TokenTrustAnalyzer {
  private apiKey: string;
  private rpcBase: string;
  private riskWeights: RiskFactors;
  private dexService: DEXService;
  private holderService: HolderService;
  private verificationService: VerificationService;
  private socialMediaService: SocialMediaService;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.rpcBase = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    this.dexService = new DEXService();
    this.holderService = new HolderService(apiKey);
    this.verificationService = new VerificationService(apiKey);

    // Initialize social media service with API keys from environment
    this.socialMediaService = new SocialMediaService(
      process.env.TWITTER_BEARER_TOKEN,
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.DISCORD_BOT_TOKEN,
      process.env.GITHUB_TOKEN
    );

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
   * Main analysis function with improved metadata fetching and DEX integration
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

    try {
      // Step 1: Get token metadata using multiple methods
      console.log("\n📄 Step 1: Fetching token metadata (multiple sources)...");
      analysis.tokenInfo = await this.getTokenMetadataMultiSource(tokenAddress);

      // Step 2: Get mint info
      console.log("\n🔧 Step 2: Checking mint authorities...");
      analysis.mintInfo = await this.getMintInfo(tokenAddress);

      // Step 3: Dynamic verification check
      console.log("\n🔍 Step 3: Dynamic token verification...");
      const verificationResult = await this.verificationService.verifyToken(
        tokenAddress,
        analysis.tokenInfo || undefined
      );

      analysis.isWhitelisted = verificationResult.isVerified;

      if (verificationResult.isVerified) {
        analysis.whitelistInfo =
          await this.verificationService.getWhitelistInfo(
            tokenAddress,
            analysis.tokenInfo || undefined
          );

        console.log(
          `✅ DYNAMICALLY VERIFIED: ${verificationResult.verificationLevel}`
        );
        console.log(`   Confidence: ${verificationResult.confidence}%`);
        console.log(`   Sources: ${verificationResult.sources.join(", ")}`);

        verificationResult.reasons.forEach((reason: string) => {
          console.log(`   • ${reason}`);
        });
      } else {
        console.log(`❌ NOT VERIFIED DYNAMICALLY`);
        console.log(`   Confidence: ${verificationResult.confidence}%`);
        console.log(`   Missing verification signals:`);
        verificationResult.reasons.forEach((reason: string) => {
          console.log(`   • ${reason}`);
        });
      }

      // Step 4: Analyze transactions
      console.log("\n📊 Step 4: Analyzing transaction patterns...");
      analysis.transactionData = await this.analyzeTransactions(tokenAddress);

      // Step 5: Creator analysis
      console.log("\n👤 Step 5: Analyzing creator behavior...");
      analysis.creatorData = await this.analyzeCreator(
        analysis.transactionData
      );

      // Step 6: DEX Analysis (NEW)
      console.log("\n🏊 Step 6: Analyzing DEX data...");
      const dexData = await this.dexService.analyzeDEXData(tokenAddress);

      // Step 7: Social Media Analysis (NEW)
      console.log("\n📱 Step 7: Analyzing social media presence...");
      const socialMediaData =
        await this.socialMediaService.analyzeTokenSocialMedia(
          tokenAddress,
          analysis.tokenInfo || undefined
        );

      // Step 8: Calculate comprehensive risk assessment
      console.log("\n⚠️ Step 8: Calculating comprehensive risk assessment...");
      this.calculateDynamicRiskScore(
        analysis,
        verificationResult,
        dexData,
        socialMediaData
      );

      // Step 9: Integrate DEX data into final response
      if (dexData) {
        (analysis as any).dexData = {
          liquidity: dexData.liquidity,
          volume: dexData.volume,
          priceData: dexData.priceData,
          rugPullRisk: dexData.rugPullRisk,
          lockStatus: dexData.lockStatus,
          pools: dexData.pools,
          volumeLiquidityAnalysis: dexData.volumeLiquidityAnalysis,
        };
      }

      console.log("\n✅ Analysis complete!");
      this.printDetailedSummary(analysis, dexData);

      return analysis;
    } catch (error) {
      console.error(
        "❌ Analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      analysis.riskFactors.push("Technical analysis failed");
      analysis.riskScore = 75;
      analysis.riskLevel = "HIGH";
      return analysis;
    }
  }

  /**
   * Get token metadata using multiple sources for better coverage
   */
  private async getTokenMetadataMultiSource(
    tokenAddress: string
  ): Promise<TokenMetadata | null> {
    console.log("   🔍 Trying multiple metadata sources...");

    // Method 1: Try DAS getAsset (works for NFTs and tokens with metadata program)
    console.log("   📝 Method 1: DAS getAsset...");
    let tokenInfo = await this.tryDASGetAsset(tokenAddress);

    if (tokenInfo) {
      console.log(`   ✅ DAS Success: ${tokenInfo.name} (${tokenInfo.symbol})`);
      return tokenInfo;
    }

    // Method 2: Try Helius Enhanced API
    console.log("   📝 Method 2: Helius Enhanced API...");
    tokenInfo = await this.tryHeliusEnhancedAPI(tokenAddress);

    if (tokenInfo) {
      console.log(
        `   ✅ Enhanced API Success: ${tokenInfo.name} (${tokenInfo.symbol})`
      );
      return tokenInfo;
    }

    // Method 3: Try Jupiter Token List
    console.log("   📝 Method 3: Jupiter Token List...");
    tokenInfo = await this.tryJupiterTokenList(tokenAddress);

    if (tokenInfo) {
      console.log(
        `   ✅ Jupiter Success: ${tokenInfo.name} (${tokenInfo.symbol})`
      );
      return tokenInfo;
    }

    // Method 4: Try Solana Token Registry
    console.log("   📝 Method 4: Solana Token Registry...");
    tokenInfo = await this.trySolanaTokenRegistry(tokenAddress);

    if (tokenInfo) {
      console.log(
        `   ✅ Registry Success: ${tokenInfo.name} (${tokenInfo.symbol})`
      );
      return tokenInfo;
    }

    // Method 5: Get basic mint info and create minimal metadata
    console.log("   📝 Method 5: Basic mint info fallback...");
    const mintInfo = await this.getMintInfo(tokenAddress);

    if (mintInfo) {
      console.log("   ✅ Created minimal metadata from mint info");
      return {
        address: tokenAddress,
        name: "Unknown Token",
        symbol: "UNKNOWN",
        decimals: mintInfo.decimals,
        supply: mintInfo.supply,
        mintAuthority: mintInfo.mintAuthority,
        freezeAuthority: mintInfo.freezeAuthority,
        interface: "SPL Token",
        mutable: false,
      };
    }

    console.log("   ❌ All metadata methods failed");
    return null;
  }

  /**
   * Try DAS getAsset method
   */
  private async tryDASGetAsset(
    tokenAddress: string
  ): Promise<TokenMetadata | null> {
    try {
      const response = await axios.post(
        this.rpcBase,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getAsset",
          params: { id: tokenAddress },
        },
        { timeout: 10000 }
      );

      const result = response.data?.result;
      if (!result) return null;

      return {
        address: tokenAddress,
        name: result.content?.metadata?.name || "Unknown",
        symbol: result.content?.metadata?.symbol || "Unknown",
        image: result.content?.links?.image || undefined,
        supply: result.token_info?.supply || "0",
        decimals: result.token_info?.decimals || 0,
        priceInfo: result.token_info?.price_info || undefined,
        interface: result.interface || "Unknown",
        mutable: result.mutable || false,
        description: result.content?.metadata?.description || undefined,
        externalUrl: result.content?.links?.external_url || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Try Helius Enhanced API for fungible tokens
   */
  private async tryHeliusEnhancedAPI(
    tokenAddress: string
  ): Promise<TokenMetadata | null> {
    try {
      // Use searchAssets with the token address
      const response = await axios.post(
        this.rpcBase,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "searchAssets",
          params: {
            grouping: ["collection", tokenAddress],
            page: 1,
            limit: 1,
          },
        },
        { timeout: 10000 }
      );

      const items = response.data?.result?.items;
      if (!items || items.length === 0) return null;

      const asset = items[0];
      return {
        address: tokenAddress,
        name:
          asset.content?.metadata?.name ||
          asset.token_info?.symbol ||
          "Unknown",
        symbol:
          asset.token_info?.symbol ||
          asset.content?.metadata?.symbol ||
          "Unknown",
        decimals: asset.token_info?.decimals || 0,
        supply: asset.token_info?.supply || "0",
        description: asset.content?.metadata?.description || undefined,
        image: asset.content?.links?.image || undefined,
        priceInfo: asset.token_info?.price_info || undefined,
        interface: asset.interface || "Fungible",
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Try Jupiter Token List
   */
  private async tryJupiterTokenList(
    tokenAddress: string
  ): Promise<TokenMetadata | null> {
    try {
      const response = await axios.get("https://token.jup.ag/all", {
        timeout: 10000,
      });
      const token = response.data.find((t: any) => t.address === tokenAddress);

      if (!token) return null;

      return {
        address: tokenAddress,
        name: token.name || "Unknown",
        symbol: token.symbol || "Unknown",
        decimals: token.decimals || 0,
        image: token.logoURI || undefined,
        externalUrl: token.website || undefined,
        interface: "SPL Token",
        mutable: false,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Try Solana Token Registry
   */
  private async trySolanaTokenRegistry(
    tokenAddress: string
  ): Promise<TokenMetadata | null> {
    try {
      const response = await axios.get(
        "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json",
        { timeout: 10000 }
      );

      const token = response.data.tokens?.find(
        (t: any) => t.address === tokenAddress
      );

      if (!token) return null;

      return {
        address: tokenAddress,
        name: token.name || "Unknown",
        symbol: token.symbol || "Unknown",
        decimals: token.decimals || 0,
        image: token.logoURI || undefined,
        interface: "SPL Token",
        mutable: false,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get mint authority info with better error handling
   */
  private async getMintInfo(tokenAddress: string): Promise<MintInfo | null> {
    try {
      const response = await axios.post(
        this.rpcBase,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [tokenAddress, { encoding: "jsonParsed" }],
        },
        { timeout: 10000 }
      );

      const accountInfo = response.data?.result?.value;
      if (!accountInfo?.data?.parsed) {
        console.log("   ⚠️ Not a valid SPL token or account not found");
        return null;
      }

      const mintData = accountInfo.data.parsed.info;
      const mintRevoked = this.isAuthorityRevoked(mintData.mintAuthority);
      const freezeRevoked = this.isAuthorityRevoked(mintData.freezeAuthority);

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
      console.log(
        "   ❌ Mint info fetch failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  }

  /**
   * Check if authority is revoked
   */
  private isAuthorityRevoked(authority: string | null): boolean {
    if (!authority) return true;

    const revokedPatterns = [
      "11111111111111111111111111111111",
      "1111111111111111111111111111111",
      "",
      null,
    ];

    return revokedPatterns.some((pattern) => authority === pattern);
  }

  /**
   * Analyze transactions with improved history fetching
   */
  private async analyzeTransactions(
    tokenAddress: string,
    limit: number = 1000 // Increased limit for better history
  ): Promise<TransactionAnalysis | null> {
    try {
      // Get recent transactions for current activity
      const recentResponse = await axios.post(
        this.rpcBase,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getSignaturesForAddress",
          params: [tokenAddress, { limit: 100 }], // Recent activity
        },
        { timeout: 15000 }
      );

      const recentTransactions = recentResponse.data?.result || [];

      if (recentTransactions.length === 0) {
        console.log("   ⚠️ No transactions found");
        return this.getEmptyTransactionAnalysis();
      }

      // For Wrapped SOL, we know it was created in 2021, so use that as fallback
      const isWrappedSOL =
        tokenAddress === "So11111111111111111111111111111111111111112";
      let firstTxTimestamp = 0;

      if (isWrappedSOL) {
        // Wrapped SOL was created around September 2021
        firstTxTimestamp = 1633046400; // September 2021
        console.log("   📅 Using known creation date for Wrapped SOL");
      } else {
        // Try to get the earliest transaction by fetching backwards
        try {
          let earliestSignature =
            recentTransactions[recentTransactions.length - 1]?.signature;
          let attempts = 0;
          const maxAttempts = 10;

          while (earliestSignature && attempts < maxAttempts) {
            const historyResponse = await axios.post(
              this.rpcBase,
              {
                jsonrpc: "2.0",
                id: 2,
                method: "getSignaturesForAddress",
                params: [
                  tokenAddress,
                  { limit: 1000, before: earliestSignature },
                ],
              },
              { timeout: 15000 }
            );

            const historicalTransactions = historyResponse.data?.result || [];
            if (historicalTransactions.length === 0) break;

            earliestSignature =
              historicalTransactions[historicalTransactions.length - 1]
                ?.signature;
            attempts++;
          }

          if (earliestSignature) {
            // Get the actual transaction details for the earliest signature
            const txResponse = await axios.post(
              this.rpcBase,
              {
                jsonrpc: "2.0",
                id: 3,
                method: "getTransaction",
                params: [
                  earliestSignature,
                  { encoding: "json", maxSupportedTransactionVersion: 0 },
                ],
              },
              { timeout: 15000 }
            );

            firstTxTimestamp = txResponse.data?.result?.blockTime || 0;
          }
        } catch (error) {
          console.log(
            "   ⚠️ Could not fetch earliest transaction, using recent data"
          );
        }
      }

      console.log(
        `   📊 Found ${recentTransactions.length} recent transactions`
      );

      const signatures = recentTransactions.map((tx: any) => tx.signature);
      const enhancedTxs = await this.getEnhancedTransactions(signatures);

      // Calculate time span with proper first transaction
      const lastTxTimestamp = recentTransactions[0]?.blockTime || 0;
      const daysActive =
        firstTxTimestamp > 0
          ? (lastTxTimestamp - firstTxTimestamp) / (24 * 60 * 60)
          : 0;

      const analysis: TransactionAnalysis = {
        totalTransactions: recentTransactions.length,
        timeSpan: {
          firstTx: firstTxTimestamp,
          lastTx: lastTxTimestamp,
          daysActive: Math.max(0, daysActive),
        },
        transferPatterns: this.analyzeTransferPatterns(enhancedTxs),
        accountActivity: this.analyzeAccountActivity(enhancedTxs),
        suspiciousActivity: this.detectSuspiciousActivity(enhancedTxs),
      };

      return analysis;
    } catch (error) {
      console.log(
        "   ❌ Transaction analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return this.getEmptyTransactionAnalysis();
    }
  }

  /**
   * Get enhanced transaction data with timeout
   */
  private async getEnhancedTransactions(
    signatures: string[]
  ): Promise<TransactionData[]> {
    try {
      const response = await axios.post(
        `https://api.helius.xyz/v0/transactions`,
        { transactions: signatures.slice(0, 50) }, // Limit to 50 for performance
        {
          params: { "api-key": this.apiKey },
          timeout: 15000,
        }
      );
      return response.data || [];
    } catch (error) {
      console.log("   ⚠️ Enhanced transaction data unavailable");
      return [];
    }
  }

  /**
   * Print detailed summary
   */
  private printDetailedSummary(analysis: TokenAnalysis, dexData?: any): void {
    console.log("\n" + "=".repeat(70));
    console.log("📊 TOKENTRUST ANALYSIS SUMMARY");
    console.log("=".repeat(70));

    if (analysis.tokenInfo) {
      console.log(
        `\n📄 Token: ${analysis.tokenInfo.name} (${analysis.tokenInfo.symbol})`
      );
      console.log(`📍 Address: ${analysis.tokenAddress}`);
      if (analysis.tokenInfo.priceInfo) {
        console.log(
          `💰 Price: $${analysis.tokenInfo.priceInfo.price_per_token} ${analysis.tokenInfo.priceInfo.currency}`
        );
      }
    }

    console.log(`\n⚠️ Risk Assessment:`);
    console.log(`   Score: ${analysis.riskScore}/100`);
    console.log(`   Level: ${analysis.riskLevel}`);

    if (analysis.safetyFactors.length > 0) {
      console.log(`\n✅ Safety Factors:`);
      analysis.safetyFactors.forEach((factor) => console.log(`   • ${factor}`));
    }

    if (analysis.riskFactors.length > 0) {
      console.log(`\n🚨 Risk Factors:`);
      analysis.riskFactors.forEach((factor) => console.log(`   • ${factor}`));
    }

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      analysis.recommendations.forEach((rec) => console.log(`   • ${rec}`));
    }

    if (dexData) {
      console.log(`\n🏊 DEX ANALYSIS:`);
      console.log(
        `   💧 Total Liquidity: $${dexData.liquidity.totalLiquidity.toLocaleString()} USD`
      );
      console.log(
        `   📈 Volume 24h: $${dexData.volume.volume24h.toLocaleString()} USD`
      );
      console.log(
        `   💰 Current Price: $${dexData.priceData.currentPrice.toFixed(6)} USD`
      );
      console.log(
        `   📊 Market Cap: $${dexData.priceData.marketCap.toLocaleString()} USD`
      );
      console.log(`   🏊 Pools: ${dexData.pools.length} DEX pools`);

      if (dexData.rugPullRisk.detected) {
        console.log(
          `   ⚠️ Rug Pull Risk: ${dexData.rugPullRisk.confidence}% confidence`
        );
      }
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

  // Additional helper methods would go here...
  private analyzeTransferPatterns(transactions: TransactionData[]): any {
    if (!transactions || transactions.length === 0) {
      return {
        totalTransfers: 0,
        uniqueSenders: 0,
        uniqueReceivers: 0,
        averageTransferSize: 0,
      };
    }

    const senders = new Set<string>();
    const receivers = new Set<string>();
    let totalTransfers = 0;
    let totalTransferAmount = 0;

    transactions.forEach((tx) => {
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        tx.tokenTransfers.forEach((transfer) => {
          if (transfer.fromUserAccount) {
            senders.add(transfer.fromUserAccount);
          }
          if (transfer.toUserAccount) {
            receivers.add(transfer.toUserAccount);
          }
          totalTransfers++;
          if (transfer.amount) {
            totalTransferAmount += parseFloat(transfer.amount);
          }
        });
      }
    });

    return {
      totalTransfers,
      uniqueSenders: senders.size,
      uniqueReceivers: receivers.size,
      averageTransferSize:
        totalTransfers > 0 ? totalTransferAmount / totalTransfers : 0,
    };
  }

  private analyzeAccountActivity(transactions: TransactionData[]): any {
    if (!transactions || transactions.length === 0) {
      return { activeAccounts: 0, newAccounts: 0, dormantAccounts: 0 };
    }

    const accountActivity = new Map<
      string,
      { firstSeen: number; lastSeen: number; txCount: number }
    >();
    const currentTime = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = currentTime - 30 * 24 * 60 * 60;

    transactions.forEach((tx) => {
      const timestamp = tx.timestamp || currentTime;

      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        tx.tokenTransfers.forEach((transfer) => {
          const accounts = [
            transfer.fromUserAccount,
            transfer.toUserAccount,
          ].filter(Boolean);

          accounts.forEach((account) => {
            if (!account) return;

            const existing = accountActivity.get(account);
            if (existing) {
              existing.lastSeen = Math.max(existing.lastSeen, timestamp);
              existing.txCount++;
            } else {
              accountActivity.set(account, {
                firstSeen: timestamp,
                lastSeen: timestamp,
                txCount: 1,
              });
            }
          });
        });
      }
    });

    let activeAccounts = 0;
    let newAccounts = 0;
    let dormantAccounts = 0;

    accountActivity.forEach((activity) => {
      if (activity.lastSeen >= thirtyDaysAgo) {
        activeAccounts++;
      } else {
        dormantAccounts++;
      }

      // Consider accounts created in last 7 days as "new"
      const sevenDaysAgo = currentTime - 7 * 24 * 60 * 60;
      if (activity.firstSeen >= sevenDaysAgo) {
        newAccounts++;
      }
    });

    return { activeAccounts, newAccounts, dormantAccounts };
  }

  private detectSuspiciousActivity(transactions: TransactionData[]): any {
    if (!transactions || transactions.length === 0) {
      return { detected: false, patterns: [], riskLevel: "LOW" };
    }

    const patterns: string[] = [];
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let detected = false;

    // Check for wash trading patterns
    const accountTxCount = new Map<string, number>();
    const recentTxs = transactions.slice(0, 20); // Check last 20 transactions

    recentTxs.forEach((tx) => {
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        tx.tokenTransfers.forEach((transfer) => {
          const accounts = [
            transfer.fromUserAccount,
            transfer.toUserAccount,
          ].filter(Boolean);
          accounts.forEach((account) => {
            if (!account) return;
            accountTxCount.set(account, (accountTxCount.get(account) || 0) + 1);
          });
        });
      }
    });

    // Check for accounts with suspiciously high transaction counts
    let highActivityAccounts = 0;
    accountTxCount.forEach((count) => {
      if (count > 5) {
        highActivityAccounts++;
      }
    });

    if (highActivityAccounts > 3) {
      patterns.push("Multiple accounts with high transaction frequency");
      detected = true;
      riskLevel = "MEDIUM";
    }

    // Check for large transfers
    let largeTransfers = 0;
    transactions.forEach((tx) => {
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        tx.tokenTransfers.forEach((transfer) => {
          if (transfer.amount && parseFloat(transfer.amount) > 1000000) {
            largeTransfers++;
          }
        });
      }
    });

    if (largeTransfers > 5) {
      patterns.push("Multiple large transfers detected");
      detected = true;
      if (riskLevel === "MEDIUM") riskLevel = "HIGH";
    }

    // Check for rapid price movements (if we have price data)
    // This would require additional price history data

    return { detected, patterns, riskLevel };
  }

  private async analyzeCreator(
    transactionData: TransactionAnalysis | null
  ): Promise<CreatorAnalysis | null> {
    // Implementation here
    return null;
  }

  /**
   * Calculate dynamic risk score with verification
   */
  private calculateDynamicRiskScore(
    analysis: TokenAnalysis,
    verificationResult: any,
    dexData?: any,
    socialMediaData?: any
  ): void {
    let totalScore = 0;
    const factors: string[] = [];
    const safetyFactors: string[] = [];

    // NEW: Check if this is a recently launched legitimate token
    const isRecentlyLaunched = this.isRecentlyLaunchedLegitimateToken(
      analysis,
      verificationResult,
      dexData,
      socialMediaData
    );

    // CRITICAL FIX: Apply whitelist override first
    if (verificationResult.isVerified) {
      // For verified tokens, apply significant risk reduction
      const verificationWeight =
        this.calculateVerificationWeight(verificationResult);
      totalScore = Math.max(0, totalScore - verificationWeight);

      safetyFactors.push(
        `Dynamically verified: ${verificationResult.verificationLevel} (${verificationResult.confidence}% confidence)`
      );
      verificationResult.sources.forEach((source: string) => {
        safetyFactors.push(`Listed on ${source}`);
      });

      // For OFFICIAL tokens, apply maximum risk reduction
      if (verificationResult.verificationLevel === "OFFICIAL") {
        totalScore = Math.max(0, totalScore - 40); // Additional reduction for official tokens
        safetyFactors.push("Official verification - maximum trust level");
      }
    } else {
      // NEW: Reduced penalty for recently launched tokens with positive signals
      if (isRecentlyLaunched) {
        const reducedPenalty = Math.max(
          5,
          15 - verificationResult.confidence * 0.1
        );
        totalScore += reducedPenalty;
        factors.push(
          "Token not verified on major platforms (recently launched)"
        );
        safetyFactors.push("Recently launched token - verification pending");
      } else {
        const unverifiedPenalty = 30 - verificationResult.confidence * 0.2;
        totalScore += Math.max(10, unverifiedPenalty);
        factors.push("Token not verified on major platforms");
      }
    }

    // Only apply additional risk factors if token is not officially verified
    if (
      !verificationResult.isVerified ||
      verificationResult.verificationLevel !== "OFFICIAL"
    ) {
      // Mint authority risk (reduced for verified tokens and recently launched)
      if (analysis.mintInfo && !analysis.mintInfo.mintRevoked) {
        let mintRisk = this.riskWeights.MINT_AUTHORITY;

        if (verificationResult.isVerified) {
          mintRisk *= 0.2; // 80% reduction for verified
        } else if (isRecentlyLaunched) {
          mintRisk *= 0.5; // 50% reduction for recently launched
        }

        totalScore += mintRisk;

        if (verificationResult.isVerified) {
          factors.push("Active mint authority (but token is verified)");
        } else if (isRecentlyLaunched) {
          factors.push(
            "Active mint authority (recently launched - monitoring)"
          );
        } else {
          factors.push("Active mint authority - unlimited supply possible");
        }
      } else if (analysis.mintInfo?.mintRevoked) {
        safetyFactors.push("Mint authority revoked - supply is fixed");
      }

      // Freeze authority risk (reduced for verified tokens and recently launched)
      if (analysis.mintInfo && !analysis.mintInfo.freezeRevoked) {
        let freezeRisk = this.riskWeights.FREEZE_AUTHORITY;

        if (verificationResult.isVerified) {
          freezeRisk *= 0.2; // 80% reduction for verified
        } else if (isRecentlyLaunched) {
          freezeRisk *= 0.5; // 50% reduction for recently launched
        }

        totalScore += freezeRisk;

        if (verificationResult.isVerified) {
          factors.push("Active freeze authority (but token is verified)");
        } else if (isRecentlyLaunched) {
          factors.push(
            "Active freeze authority (recently launched - monitoring)"
          );
        } else {
          factors.push("Active freeze authority - accounts can be frozen");
        }
      } else if (analysis.mintInfo?.freezeRevoked) {
        safetyFactors.push("Freeze authority revoked - accounts protected");
      }

      // Token age risk (reduced for recently launched legitimate tokens)
      if (analysis.transactionData) {
        const daysActive = analysis.transactionData.timeSpan.daysActive;
        if (daysActive < 1) {
          let ageRisk = this.riskWeights.TOKEN_AGE;

          if (verificationResult.isVerified) {
            ageRisk *= 0.3; // 70% reduction for verified
          } else if (isRecentlyLaunched) {
            ageRisk *= 0.4; // 60% reduction for recently launched legitimate
          }

          totalScore += ageRisk;

          if (isRecentlyLaunched) {
            factors.push("Very new token (recently launched - monitoring)");
          } else {
            factors.push("Very new token - high risk");
          }
        } else if (daysActive < 7) {
          let ageRisk = this.riskWeights.TOKEN_AGE * 0.7;

          if (verificationResult.isVerified) {
            ageRisk *= 0.2; // 80% reduction for verified
          } else if (isRecentlyLaunched) {
            ageRisk *= 0.5; // 50% reduction for recently launched legitimate
          }

          totalScore += ageRisk;

          if (isRecentlyLaunched) {
            factors.push("New token (recently launched - monitoring)");
          } else {
            factors.push("New token - moderate risk");
          }
        } else if (daysActive > 30) {
          safetyFactors.push("Established token - lower risk");
        }
      }

      // Transaction volume risk (reduced for recently launched legitimate tokens)
      if (analysis.transactionData) {
        const totalTransfers =
          analysis.transactionData.transferPatterns.totalTransfers;
        if (totalTransfers < 10) {
          let volumeRisk = this.riskWeights.TRANSACTION_VOLUME;

          if (verificationResult.isVerified) {
            volumeRisk *= 0.3; // 70% reduction for verified
          } else if (isRecentlyLaunched) {
            volumeRisk *= 0.4; // 60% reduction for recently launched legitimate
          }

          totalScore += volumeRisk;

          if (isRecentlyLaunched) {
            factors.push(
              "Low transaction volume (recently launched - monitoring)"
            );
          } else {
            factors.push("Low transaction volume - suspicious");
          }
        } else if (totalTransfers > 100) {
          safetyFactors.push("High transaction volume - active trading");
        }
      }

      // Creator behavior risk (reduced for recently launched legitimate tokens)
      if (analysis.creatorData) {
        const riskLevel = analysis.creatorData.riskAssessment.level;
        if (riskLevel === "HIGH") {
          let creatorRisk = this.riskWeights.CREATOR_BEHAVIOR;

          if (verificationResult.isVerified) {
            creatorRisk *= 0.3; // 70% reduction for verified
          } else if (isRecentlyLaunched) {
            creatorRisk *= 0.5; // 50% reduction for recently launched legitimate
          }

          totalScore += creatorRisk;

          if (isRecentlyLaunched) {
            factors.push(
              "Suspicious creator behavior (recently launched - monitoring)"
            );
          } else {
            factors.push("Suspicious creator behavior detected");
          }
        } else if (riskLevel === "LOW") {
          safetyFactors.push("Normal creator behavior patterns");
        }
      }

      // Metadata quality risk (reduced for recently launched legitimate tokens)
      if (analysis.tokenInfo) {
        if (!analysis.tokenInfo.name || analysis.tokenInfo.name === "Unknown") {
          let metadataRisk = this.riskWeights.METADATA_QUALITY;

          if (verificationResult.isVerified) {
            metadataRisk *= 0.2; // 80% reduction for verified
          } else if (isRecentlyLaunched) {
            metadataRisk *= 0.5; // 50% reduction for recently launched legitimate
          }

          totalScore += metadataRisk;

          if (isRecentlyLaunched) {
            factors.push(
              "Poor metadata quality (recently launched - monitoring)"
            );
          } else {
            factors.push("Poor metadata quality");
          }
        } else {
          safetyFactors.push("Good metadata quality");
        }
      }
    }

    // DEX risk factors (always applied but reduced for verified tokens)
    if (dexData?.rugPullRisk?.detected) {
      const rugPullRisk = verificationResult.isVerified
        ? this.riskWeights.LIQUIDITY_RISK * 0.3 // 70% reduction for verified
        : this.riskWeights.LIQUIDITY_RISK;
      totalScore += rugPullRisk;
      factors.push(
        `Rug pull risk detected (${dexData.rugPullRisk.confidence}% confidence)`
      );
      dexData.rugPullRisk.indicators.forEach((indicator: string) => {
        factors.push(`DEX: ${indicator}`);
      });
    }

    if (dexData?.liquidity?.totalLiquidity < 10000) {
      const liquidityRisk = verificationResult.isVerified
        ? this.riskWeights.LIQUIDITY_RISK * 0.4 // 60% reduction for verified
        : this.riskWeights.LIQUIDITY_RISK * 0.8;
      totalScore += liquidityRisk;
      factors.push("Very low liquidity (< $10k)");
    } else if (dexData?.liquidity?.totalLiquidity < 50000) {
      const liquidityRisk = verificationResult.isVerified
        ? this.riskWeights.LIQUIDITY_RISK * 0.2 // 80% reduction for verified
        : this.riskWeights.LIQUIDITY_RISK * 0.5;
      totalScore += liquidityRisk;
      factors.push("Low liquidity (< $50k)");
    }

    // Enhanced volume-to-liquidity analysis
    if (dexData?.volumeLiquidityAnalysis) {
      const analysis = dexData.volumeLiquidityAnalysis;

      if (analysis.context === "SUSPICIOUS") {
        const volumeRisk = verificationResult.isVerified
          ? this.riskWeights.LIQUIDITY_RISK * 0.3 // 70% reduction for verified
          : this.riskWeights.LIQUIDITY_RISK * 0.8;
        totalScore += volumeRisk;
        factors.push(
          `Suspicious volume-to-liquidity pattern: ${analysis.explanation}`
        );
      } else if (analysis.context === "LEGITIMATE") {
        safetyFactors.push(
          `Legitimate volume-to-liquidity pattern: ${analysis.explanation}`
        );
      } else {
        // NORMAL context - no additional risk
        factors.push(
          `Volume-to-liquidity ratio: ${analysis.ratio.toFixed(2)}x (${analysis.context})`
        );
      }
    } else {
      // Fallback to old logic if enhanced analysis not available
      if (
        dexData?.volume?.volume24h >
        (dexData?.liquidity?.totalLiquidity || 0) * 5
      ) {
        const volumeRisk = verificationResult.isVerified
          ? this.riskWeights.LIQUIDITY_RISK * 0.2 // 80% reduction for verified
          : this.riskWeights.LIQUIDITY_RISK * 0.6;
        totalScore += volumeRisk;
        factors.push("High volume relative to liquidity");
      }
    }

    // Add safety factors for good DEX metrics
    if (dexData?.liquidity?.totalLiquidity > 100000) {
      safetyFactors.push(
        `Strong liquidity: $${dexData.liquidity.totalLiquidity.toLocaleString()} USD`
      );
    }

    if (dexData?.lockStatus?.isLocked) {
      safetyFactors.push(
        `Liquidity locked: ${dexData.lockStatus.lockPercentage}% for ${dexData.lockStatus.lockDuration} days`
      );
    }

    if (dexData?.pools && dexData.pools.length > 1) {
      safetyFactors.push(
        `Multiple DEX pools: ${dexData.pools.length} exchanges`
      );
    }

    // Determine final risk level with proper whitelist override
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

    if (verificationResult.isVerified) {
      // For verified tokens, use much lower thresholds
      if (verificationResult.verificationLevel === "OFFICIAL") {
        // Official tokens should almost always be LOW risk
        if (totalScore >= 25) riskLevel = "MEDIUM";
        else riskLevel = "LOW";
      } else if (verificationResult.verificationLevel === "ESTABLISHED") {
        if (totalScore >= 35) riskLevel = "HIGH";
        else if (totalScore >= 20) riskLevel = "MEDIUM";
        else riskLevel = "LOW";
      } else {
        // COMMUNITY verified
        if (totalScore >= 45) riskLevel = "HIGH";
        else if (totalScore >= 30) riskLevel = "MEDIUM";
        else riskLevel = "LOW";
      }
    } else {
      // For unverified tokens, use higher thresholds
      if (totalScore >= 80) riskLevel = "CRITICAL";
      else if (totalScore >= 60) riskLevel = "HIGH";
      else if (totalScore >= 40) riskLevel = "MEDIUM";
      else riskLevel = "LOW";
    }

    analysis.riskScore = Math.round(totalScore);
    analysis.riskLevel = riskLevel;
    analysis.riskFactors = factors;
    analysis.safetyFactors = safetyFactors;
    analysis.recommendations = this.generateDynamicRecommendations(
      totalScore,
      verificationResult,
      isRecentlyLaunched
    );

    // Set whitelist info for compatibility
    if (verificationResult.isVerified && !analysis.whitelistInfo) {
      analysis.isWhitelisted = true;
      analysis.whitelistInfo = {
        name: analysis.tokenInfo?.name || "Verified Token",
        symbol: analysis.tokenInfo?.symbol || "VERIFIED",
        reason: verificationResult.reasons.join(", "),
        riskOverride: this.getRiskOverrideForVerification(
          verificationResult.verificationLevel
        ),
      };
    }
  }

  /**
   * Calculate verification weight
   */
  private calculateVerificationWeight(verificationResult: any): number {
    const weights: { [key: string]: number } = {
      OFFICIAL: 50,
      ESTABLISHED: 35,
      COMMUNITY: 20,
      UNVERIFIED: 0,
    };
    const baseWeight = weights[verificationResult.verificationLevel] || 0;
    const confidenceMultiplier = verificationResult.confidence / 100;
    return Math.round(baseWeight * confidenceMultiplier);
  }

  /**
   * Get risk override for verification level
   */
  private getRiskOverrideForVerification(
    level: string
  ): "LOW" | "MEDIUM" | "HIGH" {
    switch (level) {
      case "OFFICIAL":
        return "LOW";
      case "ESTABLISHED":
        return "LOW";
      case "COMMUNITY":
        return "MEDIUM";
      default:
        return "HIGH";
    }
  }

  /**
   * Generate dynamic recommendations
   */
  private generateDynamicRecommendations(
    riskScore: number,
    verificationResult: any,
    isRecentlyLaunched: boolean = false
  ): string[] {
    const recommendations: string[] = [];

    if (verificationResult.isVerified) {
      recommendations.push(
        `✅ VERIFIED: ${verificationResult.verificationLevel} verification level`
      );
      recommendations.push(
        `🔍 Verified on: ${verificationResult.sources.join(", ")}`
      );
      if (riskScore > 20) {
        recommendations.push(
          "⚠️ Note: Despite verification, some risk factors remain"
        );
      }
    } else if (isRecentlyLaunched) {
      // Special recommendations for recently launched legitimate tokens
      recommendations.push(
        "🆕 RECENTLY LAUNCHED: Token shows positive signals"
      );
      recommendations.push("📈 Monitor for verification on major platforms");
      recommendations.push(
        "🔍 Check for ongoing development and community activity"
      );

      if (riskScore >= 60) {
        recommendations.push(
          "⚠️ HIGH RISK: Exercise caution despite positive signals"
        );
      } else if (riskScore >= 40) {
        recommendations.push("⚠️ MODERATE RISK: Monitor closely for red flags");
      } else {
        recommendations.push(
          "✅ LOW RISK: Promising new token - continue monitoring"
        );
      }

      recommendations.push(
        "💡 Tip: Wait for verification before major investments"
      );
    } else {
      if (riskScore >= 80) {
        recommendations.push("🚨 EXTREME RISK: Avoid this token completely");
      } else if (riskScore >= 60) {
        recommendations.push("⚠️ HIGH RISK: Exercise extreme caution");
      } else {
        recommendations.push(
          "⚠️ UNVERIFIED: Token lacks verification but may be legitimate"
        );
      }
    }

    return recommendations;
  }

  /**
   * Detect if this is a recently launched legitimate token
   * Uses positive signals to identify legitimate new tokens
   */
  private isRecentlyLaunchedLegitimateToken(
    analysis: TokenAnalysis,
    verificationResult: any,
    dexData?: any,
    socialMediaData?: any
  ): boolean {
    let positiveSignals = 0;
    let totalSignals = 0;

    // Signal 1: Token age (must be recent but not too recent)
    if (analysis.transactionData) {
      const daysActive = analysis.transactionData.timeSpan.daysActive;
      totalSignals++;

      if (daysActive >= 0.1 && daysActive <= 30) {
        // Between 2.4 hours and 30 days
        positiveSignals++;
      }
    }

    // Signal 2: Has some transaction activity
    if (analysis.transactionData) {
      const totalTransfers =
        analysis.transactionData.transferPatterns.totalTransfers;
      totalSignals++;

      if (totalTransfers >= 5) {
        // At least 5 transfers
        positiveSignals++;
      }
    }

    // Signal 3: Has basic metadata
    if (analysis.tokenInfo) {
      totalSignals++;

      if (analysis.tokenInfo.name && analysis.tokenInfo.name !== "Unknown") {
        positiveSignals++;
      }
    }

    // Signal 4: Has some liquidity (even if small)
    if (dexData?.liquidity?.totalLiquidity) {
      totalSignals++;

      if (dexData.liquidity.totalLiquidity > 100) {
        // At least $100 liquidity
        positiveSignals++;
      }
    }

    // Signal 5: No obvious scam indicators
    totalSignals++;
    let hasScamIndicators = false;

    // Check for obvious scam patterns
    if (analysis.tokenInfo?.name) {
      const name = analysis.tokenInfo.name.toLowerCase();
      const scamKeywords = [
        "inu",
        "moon",
        "safe",
        "elon",
        "doge",
        "shib",
        "pepe",
        "wojak",
      ];
      hasScamIndicators = scamKeywords.some((keyword) =>
        name.includes(keyword)
      );
    }

    if (!hasScamIndicators) {
      positiveSignals++;
    }

    // Signal 6: Creator behavior is not suspicious
    if (analysis.creatorData) {
      totalSignals++;

      if (analysis.creatorData.riskAssessment.level !== "HIGH") {
        positiveSignals++;
      }
    }

    // Signal 7: Has some volume activity
    if (dexData?.volume?.volume24h) {
      totalSignals++;

      if (dexData.volume.volume24h > 10) {
        // At least $10 in 24h volume
        positiveSignals++;
      }
    }

    // Signal 8: No rug pull indicators
    if (dexData?.rugPullRisk) {
      totalSignals++;

      if (!dexData.rugPullRisk.detected) {
        positiveSignals++;
      }
    }

    // NEW: Signal 9: Strong social media presence
    if (socialMediaData) {
      totalSignals++;

      if (socialMediaData.overallScore >= 50) {
        // Good social media score
        positiveSignals++;
      }
    }

    // NEW: Signal 10: Verified social media accounts
    if (socialMediaData?.twitterMetrics?.verified) {
      totalSignals++;
      positiveSignals++; // Verified Twitter is a strong positive signal
    }

    // NEW: Signal 11: Active community
    if (socialMediaData) {
      const hasActiveCommunity =
        socialMediaData.telegramMetrics?.members > 1000 ||
        socialMediaData.discordMetrics?.members > 500 ||
        socialMediaData.twitterMetrics?.followers > 5000;

      if (hasActiveCommunity) {
        totalSignals++;
        positiveSignals++;
      }
    }

    // Calculate confidence score
    const confidence =
      totalSignals > 0 ? (positiveSignals / totalSignals) * 100 : 0;

    // Consider it recently launched legitimate if:
    // 1. At least 60% positive signals
    // 2. At least 4 total signals checked
    // 3. Token is actually recent (less than 30 days)
    const isRecent =
      analysis.transactionData?.timeSpan?.daysActive !== undefined &&
      analysis.transactionData.timeSpan.daysActive <= 30;
    const hasEnoughSignals = totalSignals >= 4;
    const hasGoodConfidence = confidence >= 60;

    const isRecentlyLaunched =
      isRecent && hasEnoughSignals && hasGoodConfidence;

    // Log the detection for debugging
    if (isRecentlyLaunched) {
      console.log(`🔍 Recently Launched Legitimate Token Detected:`);
      console.log(
        `   Positive Signals: ${positiveSignals}/${totalSignals} (${confidence.toFixed(1)}%)`
      );
      console.log(
        `   Days Active: ${analysis.transactionData?.timeSpan.daysActive.toFixed(1)}`
      );
      console.log(
        `   Social Media Score: ${socialMediaData?.overallScore || 0}/100`
      );
      console.log(`   Confidence: ${confidence.toFixed(1)}%`);
    }

    return isRecentlyLaunched;
  }
}
