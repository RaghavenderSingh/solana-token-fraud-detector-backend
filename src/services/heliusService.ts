import axios from "axios";

interface HeliusConfig {
  apiKey: string;
  baseUrl: string;
}

interface TokenMetadata {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  supply?: string;
  mintAuthority?: string;
  freezeAuthority?: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  [key: string]: any;
}

interface TokenTransaction {
  signature: string;
  timestamp: number;
  type: string;
  description?: string;
  tokenTransfers?: any[];
  nativeTransfers?: any[];
  accountData?: any[];
  [key: string]: any;
}

export class HeliusService {
  private config: HeliusConfig;

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      baseUrl: "https://api.helius.xyz/v0",
    };
  }

  /**
   * Test Helius connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/addresses/vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg/transactions`,
        {
          params: {
            "api-key": this.config.apiKey,
            limit: 1,
          },
        }
      );

      console.log("✅ Helius connection successful");
      return response.status === 200;
    } catch (error) {
      console.error("❌ Helius connection failed:", error);
      return false;
    }
  }

  /**
   * Get token metadata using Helius DAS API
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    try {
      console.log(`🔍 Fetching token metadata for: ${tokenAddress}`);

      const response = await axios.post(
        "https://mainnet.helius-rpc.com/?api-key=" + this.config.apiKey,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getAsset",
          params: { id: tokenAddress },
        }
      );

      if (response.data?.result) {
        const result = response.data.result;
        const token: TokenMetadata = {
          address: tokenAddress,
          name: result.content?.metadata?.name || null,
          symbol: result.content?.metadata?.symbol || null,
          decimals: result.token_info?.decimals || null,
          supply: result.token_info?.supply || null,
          mintAuthority: result.token_info?.mint_authority || null,
          freezeAuthority: result.token_info?.freeze_authority || null,
          description: result.content?.metadata?.description || null,
          image: result.content?.links?.image || null,
          externalUrl: result.content?.links?.external_url || null,
        };

        console.log(
          "📄 Token metadata received:",
          JSON.stringify(token, null, 2)
        );
        return token;
      }

      console.log("⚠️ No token metadata found");
      return null;
    } catch (error) {
      console.error("❌ Error fetching token metadata:", error);
      return null;
    }
  }

  /**
   * Get token transactions
   */
  async getTokenTransactions(
    tokenAddress: string,
    limit: number = 10
  ): Promise<TokenTransaction[]> {
    try {
      console.log(`🔍 Fetching transactions for token: ${tokenAddress}`);

      const response = await axios.get(
        `${this.config.baseUrl}/addresses/${tokenAddress}/transactions`,
        {
          params: {
            "api-key": this.config.apiKey,
            limit,
          },
        }
      );

      if (response.data && Array.isArray(response.data)) {
        console.log(`📊 Found ${response.data.length} transactions`);
        console.log(
          "🔍 Sample transaction:",
          JSON.stringify(response.data[0], null, 2)
        );
        return response.data;
      }

      return [];
    } catch (error) {
      console.error("❌ Error fetching token transactions:", error);
      return [];
    }
  }

  /**
   * Get enhanced transaction data
   */
  async getEnhancedTransactions(signatures: string[]): Promise<any[]> {
    try {
      console.log(
        `🔍 Fetching enhanced data for ${signatures.length} transactions`
      );

      const response = await axios.post(
        `${this.config.baseUrl}/transactions`,
        {
          transactions: signatures,
        },
        {
          params: {
            "api-key": this.config.apiKey,
          },
        }
      );

      if (response.data && Array.isArray(response.data)) {
        console.log("📊 Enhanced transaction data received");
        return response.data;
      }

      return [];
    } catch (error) {
      console.error("❌ Error fetching enhanced transactions:", error);
      return [];
    }
  }

  /**
   * Get wallet token holdings
   */
  async getWalletTokens(walletAddress: string): Promise<any[]> {
    try {
      console.log(`🔍 Fetching token holdings for wallet: ${walletAddress}`);

      const response = await axios.get(
        `${this.config.baseUrl}/addresses/${walletAddress}/balances`,
        {
          params: {
            "api-key": this.config.apiKey,
          },
        }
      );

      if (response.data?.tokens) {
        console.log(`📊 Found ${response.data.tokens.length} token holdings`);
        return response.data.tokens;
      }

      return [];
    } catch (error) {
      console.error("❌ Error fetching wallet tokens:", error);
      return [];
    }
  }

  /**
   * Search for tokens by name/symbol
   */
  async searchTokens(
    query: string,
    limit: number = 20
  ): Promise<TokenMetadata[]> {
    try {
      console.log(`🔍 Searching tokens for: ${query}`);

      const response = await axios.get(`${this.config.baseUrl}/tokens/search`, {
        params: {
          "api-key": this.config.apiKey,
          query,
          limit,
        },
      });

      if (response.data?.tokens) {
        console.log(`📊 Found ${response.data.tokens.length} matching tokens`);
        return response.data.tokens;
      }

      return [];
    } catch (error) {
      console.error("❌ Error searching tokens:", error);
      return [];
    }
  }

  /**
   * Comprehensive token analysis - combines multiple API calls
   */
  async analyzeToken(tokenAddress: string): Promise<any> {
    console.log(`\n🚀 Starting comprehensive analysis for: ${tokenAddress}`);
    console.log("=".repeat(60));

    const analysis = {
      tokenAddress,
      metadata: null as TokenMetadata | null,
      transactions: [] as TokenTransaction[],
      creatorAnalysis: null as any,
      riskFactors: [] as string[],
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Get token metadata
      console.log("\n📄 Step 1: Fetching token metadata...");
      analysis.metadata = await this.getTokenMetadata(tokenAddress);

      // 2. Get recent transactions
      console.log("\n📊 Step 2: Fetching recent transactions...");
      analysis.transactions = await this.getTokenTransactions(tokenAddress, 20);

      // 3. Analyze creator if available
      if (analysis.metadata && analysis.transactions.length > 0) {
        console.log("\n👤 Step 3: Analyzing creator wallet...");
        const creatorAddress =
          analysis.transactions[analysis.transactions.length - 1]?.feePayer;

        if (creatorAddress) {
          console.log(`🔍 Creator identified: ${creatorAddress}`);
          const creatorTokens = await this.getWalletTokens(creatorAddress);
          analysis.creatorAnalysis = {
            address: creatorAddress,
            tokenCount: creatorTokens.length,
            tokens: creatorTokens.slice(0, 5), // First 5 for analysis
          };
        }
      }

      // 4. Basic risk analysis
      console.log("\n⚠️ Step 4: Basic risk assessment...");
      analysis.riskFactors = this.assessBasicRisk(analysis);

      console.log("\n✅ Analysis complete!");
      console.log("=".repeat(60));
      return analysis;
    } catch (error) {
      console.error("❌ Error during token analysis:", error);
      return analysis;
    }
  }

  /**
   * Basic risk assessment based on available data
   */
  private assessBasicRisk(analysis: any): string[] {
    const risks: string[] = [];

    if (!analysis.metadata) {
      risks.push("No metadata available - suspicious");
      return risks;
    }

    // Check mint authority
    if (
      analysis.metadata.mintAuthority &&
      analysis.metadata.mintAuthority !== "11111111111111111111111111111111"
    ) {
      risks.push("Mint authority not revoked - can create unlimited tokens");
    }

    // Check freeze authority
    if (
      analysis.metadata.freezeAuthority &&
      analysis.metadata.freezeAuthority !== "11111111111111111111111111111111"
    ) {
      risks.push("Freeze authority active - can freeze user tokens");
    }

    // Check creator token count
    if (analysis.creatorAnalysis?.tokenCount > 10) {
      risks.push(
        `Creator has ${analysis.creatorAnalysis.tokenCount} tokens - possible serial creator`
      );
    }

    // Check transaction count
    if (analysis.transactions.length < 5) {
      risks.push("Very few transactions - low activity token");
    }

    // Check metadata quality
    if (!analysis.metadata.name || !analysis.metadata.symbol) {
      risks.push("Missing basic token information");
    }

    if (risks.length === 0) {
      risks.push("No major red flags detected");
    }

    return risks;
  }
}

// Test script to explore token data
export async function exploreTokenData() {
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    console.error("❌ HELIUS_API_KEY not found in environment variables");
    return;
  }

  const helius = new HeliusService(apiKey);

  // Test connection first
  console.log("🔌 Testing Helius connection...");
  const connected = await helius.testConnection();

  if (!connected) {
    console.error("❌ Cannot connect to Helius API");
    return;
  }

  // Test tokens to analyze
  const testTokens = [
    "So11111111111111111111111111111111111111112", // wSOL (safe)
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC (safe)
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK (meme but established)
  ];

  for (const token of testTokens) {
    try {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`🎯 ANALYZING TOKEN: ${token}`);
      console.log(`${"=".repeat(80)}`);

      const analysis = await helius.analyzeToken(token);

      console.log("\n📋 ANALYSIS SUMMARY:");
      console.log(
        `Token: ${analysis.metadata?.name || "Unknown"} (${
          analysis.metadata?.symbol || "Unknown"
        })`
      );
      console.log(`Risk Factors: ${analysis.riskFactors.length}`);
      analysis.riskFactors.forEach((risk: string, i: number) => {
        console.log(`  ${i + 1}. ${risk}`);
      });

      // Wait between requests to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Error analyzing ${token}:`, error);
    }
  }
}

// Export for use in main application
export default HeliusService;
