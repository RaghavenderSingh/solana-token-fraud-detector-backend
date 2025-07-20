import axios from "axios";
import { TokenMetadata, WhitelistInfo } from "../types";

interface VerificationResult {
  isVerified: boolean;
  verificationLevel: "OFFICIAL" | "ESTABLISHED" | "COMMUNITY" | "UNVERIFIED";
  confidence: number;
  reasons: string[];
  sources: string[];
}

interface ExternalRegistry {
  name: string;
  endpoint: string;
  type: "coingecko" | "jupiter" | "orca" | "raydium" | "community";
  weight: number;
}

export class VerificationService {
  private registries: ExternalRegistry[];
  private heliusApiKey: string;
  private cache: Map<string, { result: VerificationResult; timestamp: number }>;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(heliusApiKey: string) {
    this.heliusApiKey = heliusApiKey;
    this.cache = new Map();
    this.registries = [
      {
        name: "CoinGecko",
        endpoint: "https://api.coingecko.com/api/v3/coins/solana/contract/",
        type: "coingecko",
        weight: 40,
      },
      {
        name: "Jupiter Token List",
        endpoint: "https://token.jup.ag/all",
        type: "jupiter",
        weight: 30,
      },
      {
        name: "Solana Token Registry",
        endpoint:
          "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json",
        type: "community",
        weight: 25,
      },
    ];
  }

  async verifyToken(
    tokenAddress: string,
    metadata?: TokenMetadata
  ): Promise<VerificationResult> {
    const cached = this.cache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    const verificationChecks = await Promise.allSettled([
      this.checkCoinGeckoListing(tokenAddress),
      this.checkJupiterListing(tokenAddress),
      this.checkSolanaTokenRegistry(tokenAddress),
      this.checkOnChainVerification(tokenAddress, metadata),
      this.checkLiquidityPresence(tokenAddress),
      this.checkGovernanceTokens(tokenAddress),
    ]);

    const result = this.aggregateVerificationResults(
      tokenAddress,
      verificationChecks,
      metadata
    );

    this.cache.set(tokenAddress, {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  private async checkCoinGeckoListing(tokenAddress: string): Promise<{
    verified: boolean;
    weight: number;
    source: string;
    details?: any;
  }> {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/solana/contract/${tokenAddress}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.id) {
        return {
          verified: true,
          weight: 40,
          source: "CoinGecko",
          details: {
            name: response.data.name,
            symbol: response.data.symbol,
            marketCapRank: response.data.market_cap_rank,
            trustScore: response.data.coingecko_score,
          },
        };
      }
    } catch (error) {
      // Not found on CoinGecko - this is normal for many tokens
    }

    return { verified: false, weight: 0, source: "CoinGecko" };
  }

  private async checkJupiterListing(tokenAddress: string): Promise<{
    verified: boolean;
    weight: number;
    source: string;
    details?: any;
  }> {
    try {
      const response = await axios.get("https://token.jup.ag/all", {
        timeout: 10000,
      });

      const token = response.data.find((t: any) => t.address === tokenAddress);
      if (token) {
        return {
          verified: true,
          weight: 30,
          source: "Jupiter",
          details: {
            name: token.name,
            symbol: token.symbol,
            verified: token.verified || false,
            strict: token.strict || false,
          },
        };
      }
    } catch (error) {
      console.log(
        "⚠️ Jupiter check failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return { verified: false, weight: 0, source: "Jupiter" };
  }

  private async checkSolanaTokenRegistry(tokenAddress: string): Promise<{
    verified: boolean;
    weight: number;
    source: string;
    details?: any;
  }> {
    try {
      const response = await axios.get(
        "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json",
        { timeout: 10000 }
      );

      const token = response.data.tokens?.find(
        (t: any) => t.address === tokenAddress
      );
      if (token) {
        return {
          verified: true,
          weight: 25,
          source: "Solana Token Registry",
          details: {
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI,
            tags: token.tags || [],
          },
        };
      }
    } catch (error) {
      console.log(
        "⚠️ Solana registry check failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return { verified: false, weight: 0, source: "Solana Token Registry" };
  }

  private async checkOnChainVerification(
    tokenAddress: string,
    metadata?: TokenMetadata
  ): Promise<{
    verified: boolean;
    weight: number;
    source: string;
    details?: any;
  }> {
    try {
      if (metadata) {
        const verificationSignals = {
          hasOfficialMetadata: !!(
            metadata.name &&
            metadata.symbol &&
            metadata.image
          ),
          hasWebsite: !!metadata.externalUrl,
          hasDescription: !!metadata.description,
          isImmutable: !metadata.mutable,
          hasProperDecimals:
            metadata.decimals !== undefined && metadata.decimals <= 18,
        };

        const signalCount =
          Object.values(verificationSignals).filter(Boolean).length;
        const confidence =
          (signalCount / Object.keys(verificationSignals).length) * 100;

        if (confidence >= 80) {
          return {
            verified: true,
            weight: 15,
            source: "On-chain Metadata",
            details: verificationSignals,
          };
        }
      }
    } catch (error) {
      console.log(
        "⚠️ On-chain verification failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return { verified: false, weight: 0, source: "On-chain Metadata" };
  }

  private async checkLiquidityPresence(tokenAddress: string): Promise<{
    verified: boolean;
    weight: number;
    source: string;
    details?: any;
  }> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        { timeout: 5000 }
      );

      if (response.data?.pairs && response.data.pairs.length > 0) {
        const totalLiquidity = response.data.pairs.reduce(
          (sum: number, pair: any) =>
            sum + (parseFloat(pair.liquidity?.usd) || 0),
          0
        );

        if (totalLiquidity > 50000) {
          return {
            verified: true,
            weight: 20,
            source: "DEX Liquidity",
            details: {
              totalLiquidity,
              pairCount: response.data.pairs.length,
              mainDex: response.data.pairs[0]?.dexId,
            },
          };
        }
      }
    } catch (error) {
      console.log(
        "⚠️ Liquidity check failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return { verified: false, weight: 0, source: "DEX Liquidity" };
  }

  private async checkGovernanceTokens(tokenAddress: string): Promise<{
    verified: boolean;
    weight: number;
    source: string;
    details?: any;
  }> {
    const knownGovernanceTokens: Record<string, string> = {
      JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "Jupiter DAO",
      ORCAX7vD6bGYMGYF2LBuqRw4FNjWs4u5H6VqqqsJ7vc: "Orca DAO",
      RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a: "Rollbit Coin",
    };

    const protocol = knownGovernanceTokens[tokenAddress];
    if (protocol) {
      return {
        verified: true,
        weight: 35,
        source: "Governance Token",
        details: {
          protocol: protocol,
          type: "governance",
        },
      };
    }

    return { verified: false, weight: 0, source: "Governance Token" };
  }

  private aggregateVerificationResults(
    tokenAddress: string,
    checks: PromiseSettledResult<any>[],
    metadata?: TokenMetadata
  ): VerificationResult {
    let totalWeight = 0;
    let verifiedWeight = 0;
    const reasons: string[] = [];
    const sources: string[] = [];

    const criticalTokens: { [key: string]: string } = {
      So11111111111111111111111111111111111111112: "Native SOL wrapper",
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "Circle USDC",
      Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "Tether USDT",
    };

    const criticalToken = criticalTokens[tokenAddress];
    if (criticalToken) {
      return {
        isVerified: true,
        verificationLevel: "OFFICIAL",
        confidence: 100,
        reasons: [`Critical infrastructure: ${criticalToken}`],
        sources: ["System Registry"],
      };
    }

    checks.forEach((check) => {
      if (check.status === "fulfilled" && check.value) {
        const result = check.value;
        totalWeight += result.weight || 0;

        if (result.verified) {
          verifiedWeight += result.weight || 0;
          reasons.push(`Verified on ${result.source}`);
          sources.push(result.source);

          if (result.details) {
            if (result.details.verified)
              reasons.push("Strictly verified listing");
            if (result.details.trustScore > 80)
              reasons.push("High trust score");
            if (
              result.details.marketCapRank &&
              result.details.marketCapRank < 100
            ) {
              reasons.push("Top 100 market cap");
            }
          }
        }
      }
    });

    const confidence =
      totalWeight > 0 ? Math.round((verifiedWeight / totalWeight) * 100) : 0;

    let verificationLevel:
      | "OFFICIAL"
      | "ESTABLISHED"
      | "COMMUNITY"
      | "UNVERIFIED" = "UNVERIFIED";
    let isVerified = false;

    if (confidence >= 80 && verifiedWeight >= 60) {
      verificationLevel = "OFFICIAL";
      isVerified = true;
    } else if (confidence >= 60 && verifiedWeight >= 40) {
      verificationLevel = "ESTABLISHED";
      isVerified = true;
    } else if (confidence >= 40 && verifiedWeight >= 20) {
      verificationLevel = "COMMUNITY";
      isVerified = true;
    }

    if (metadata && !isVerified) {
      if (!metadata.name || !metadata.symbol) {
        reasons.push("Missing basic metadata");
      }
      if (!metadata.image) {
        reasons.push("No token image");
      }
      if (!metadata.description) {
        reasons.push("No token description");
      }
    }

    return {
      isVerified,
      verificationLevel,
      confidence,
      reasons: reasons.length > 0 ? reasons : ["No verification sources found"],
      sources,
    };
  }

  async getWhitelistInfo(
    tokenAddress: string,
    metadata?: TokenMetadata
  ): Promise<WhitelistInfo | null> {
    const verification = await this.verifyToken(tokenAddress, metadata);

    if (!verification.isVerified) {
      return null;
    }

    let riskOverride: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";

    if (verification.verificationLevel === "OFFICIAL") {
      riskOverride = "LOW";
    } else if (verification.verificationLevel === "ESTABLISHED") {
      riskOverride = "LOW";
    } else if (verification.verificationLevel === "COMMUNITY") {
      riskOverride = "MEDIUM";
    }

    return {
      name: metadata?.name || "Verified Token",
      symbol: metadata?.symbol || "VERIFIED",
      reason: verification.reasons.join(", "),
      riskOverride,
    };
  }

  clearCache(tokenAddress?: string): void {
    if (tokenAddress) {
      this.cache.delete(tokenAddress);
    } else {
      this.cache.clear();
    }
  }

  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0,
    };
  }
}

export default VerificationService;
