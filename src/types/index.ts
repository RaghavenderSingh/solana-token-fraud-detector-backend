// TokenTrust Core Types
// Based on Architecture.md and Development Phases specifications

export interface TokenMetadata {
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
  interface?: string;
  mutable?: boolean;
  priceInfo?: {
    price_per_token: number;
    currency: string;
  };
  [key: string]: any;
}

export interface MintInfo {
  decimals: number;
  supply: string;
  actualSupply: number;
  mintAuthority: string;
  freezeAuthority: string;
  mintRevoked: boolean;
  freezeRevoked: boolean;
}

export interface TransactionData {
  signature: string;
  timestamp: number;
  type: string;
  description?: string;
  tokenTransfers?: any[];
  nativeTransfers?: any[];
  accountData?: any[];
  [key: string]: any;
}

export interface TransactionAnalysis {
  totalTransactions: number;
  timeSpan: {
    firstTx: number;
    lastTx: number;
    daysActive: number;
  };
  transferPatterns: {
    totalTransfers: number;
    uniqueSenders: number;
    uniqueReceivers: number;
    averageTransferSize: number;
  };
  accountActivity: {
    activeAccounts: number;
    newAccounts: number;
    dormantAccounts: number;
  };
  suspiciousActivity: {
    detected: boolean;
    patterns: string[];
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  };
}

export interface CreatorAnalysis {
  creatorAddress?: string;
  creatorActivity: {
    totalTransactions: number;
    lastActivity: number;
    daysSinceLastActivity: number;
  };
  behaviorPatterns: {
    isActive: boolean;
    hasMultipleTokens: boolean;
    suspiciousPatterns: string[];
  };
  riskAssessment: {
    level: "LOW" | "MEDIUM" | "HIGH";
    factors: string[];
  };
}

export interface RiskFactors {
  MINT_AUTHORITY: number;
  FREEZE_AUTHORITY: number;
  TOKEN_AGE: number;
  TRANSACTION_VOLUME: number;
  CREATOR_BEHAVIOR: number;
  METADATA_QUALITY: number;
  LIQUIDITY_RISK: number;
  HOLDER_CONCENTRATION: number;
}

export interface WhitelistInfo {
  name: string;
  symbol: string;
  reason: string;
  riskOverride: "LOW" | "MEDIUM" | "HIGH";
}

export interface TokenAnalysis {
  tokenAddress: string;
  timestamp: string;
  tokenInfo: TokenMetadata | null;
  mintInfo: MintInfo | null;
  transactionData: TransactionAnalysis | null;
  creatorData: CreatorAnalysis | null;
  isWhitelisted: boolean;
  whitelistInfo: WhitelistInfo | null;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskFactors: string[];
  safetyFactors: string[];
  recommendations: string[];
  dexData?: {
    liquidity: LiquidityAnalysis;
    volume: VolumeAnalysis;
    priceData: {
      currentPrice: number;
      priceChange24h: number;
      priceChange7d: number;
      high24h: number;
      low24h: number;
      marketCap: number;
      fullyDilutedValue: number;
    };
    rugPullRisk: RugPullRisk;
    lockStatus: LockStatus;
    pools: any[];
  };
}

// DEX Analysis Types
export interface LiquidityAnalysis {
  totalLiquidity: number;
  liquidityDepth: {
    low: number;
    medium: number;
    high: number;
  };
  volume24h: number;
  priceImpact: number;
  poolCount: number;
  dexDistribution: {
    [dex: string]: number;
  };
}

export interface RugPullRisk {
  detected: boolean;
  confidence: number;
  indicators: string[];
  lastLiquidityChange: number;
  liquidityRemovalRate: number;
}

export interface VolumeAnalysis {
  volume24h: number;
  volume7d: number;
  volumeChange24h: number;
  volumeChange7d: number;
  averageTradeSize: number;
  volumePatterns: string[];
}

export interface LockStatus {
  isLocked: boolean;
  lockPercentage: number;
  lockDuration: number;
  lockProvider: string;
  lockAddress: string;
}

// Social Analysis Types
export interface TwitterMetrics {
  followers: number;
  following: number;
  tweets: number;
  mentions24h: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  engagementRate: number;
  botScore: number;
}

export interface TelegramHealth {
  members: number;
  onlineMembers: number;
  messageVolume24h: number;
  adminCount: number;
  isVerified: boolean;
  activityLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface DiscordActivity {
  members: number;
  onlineMembers: number;
  channels: number;
  messageVolume24h: number;
  developerActivity: boolean;
  communityHealth: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
}

export interface RedditSentiment {
  subscribers: number;
  posts24h: number;
  comments24h: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  topKeywords: string[];
  communityQuality: "LOW" | "MEDIUM" | "HIGH";
}

// Web Analysis Types
export interface WebsiteQuality {
  domainAge: number;
  hasSSL: boolean;
  contentQuality: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
  designQuality: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
  socialLinks: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    github?: string;
  };
  loadTime: number;
  mobileFriendly: boolean;
}

export interface WhitepaperQuality {
  exists: boolean;
  quality: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
  technicalDepth: number;
  roadmapClarity: number;
  teamInformation: boolean;
  tokenomics: boolean;
}

export interface TeamCredibility {
  teamSize: number;
  verifiedMembers: number;
  linkedinProfiles: number;
  githubProfiles: number;
  experienceLevel: "JUNIOR" | "MID" | "SENIOR" | "EXPERT";
  credibilityScore: number;
}

export interface DomainHistory {
  creationDate: string;
  lastUpdated: string;
  registrar: string;
  dnsRecords: string[];
  previousOwners: number;
  reputationScore: number;
}

// AI Analysis Types
export interface AIInsights {
  contextualRisk: string;
  patternRecognition: string[];
  narrativeAssessment: string;
  scamTechniques: string[];
  confidence: number;
}

export interface Prediction {
  outcome: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  confidence: number;
  timeframe: string;
  reasoning: string;
}

export interface Pattern {
  type: string;
  description: string;
  confidence: number;
  examples: string[];
}

// Multi-Source Data Types
export interface MultiSourceData {
  onChain: {
    tokenMetadata: TokenMetadata;
    mintInfo: MintInfo;
    transactionAnalysis: TransactionAnalysis;
    creatorAnalysis: CreatorAnalysis;
  };
  dex?: {
    liquidity: LiquidityAnalysis;
    volume: VolumeAnalysis;
    rugPullRisk: RugPullRisk;
    lockStatus: LockStatus;
  };
  social?: {
    twitter?: TwitterMetrics;
    telegram?: TelegramHealth;
    discord?: DiscordActivity;
    reddit?: RedditSentiment;
  };
  web?: {
    website?: WebsiteQuality;
    whitepaper?: WhitepaperQuality;
    team?: TeamCredibility;
    domain?: DomainHistory;
  };
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AnalysisRequest {
  tokenAddress: string;
  includeDex?: boolean;
  includeSocial?: boolean;
  includeWeb?: boolean;
  includeAI?: boolean;
}

export interface AnalysisResponse extends APIResponse<TokenAnalysis> {
  analysisId?: string;
  processingTime?: number;
  dataSources?: string[];
}

// Configuration Types
export interface TokenTrustConfig {
  heliusApiKey: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  redisUrl?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  environment: "development" | "production" | "test";
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

// Service Interfaces
export interface IDataSource {
  name: string;
  isAvailable(): boolean;
  testConnection(): Promise<boolean>;
}

export interface IAnalysisService {
  analyzeToken(tokenAddress: string): Promise<TokenAnalysis>;
  getAnalysisHistory(tokenAddress: string): Promise<TokenAnalysis[]>;
  clearCache(tokenAddress?: string): Promise<void>;
}

export interface IRiskModel {
  name: string;
  analyze(data: any): Promise<number>;
  getFactors(): string[];
}

export interface IAIContextEngine {
  generateContext(
    data: MultiSourceData,
    riskFactors: string[]
  ): Promise<AIInsights>;
  explainRisk(riskScore: number, factors: string[]): Promise<string>;
  predictOutcome(analysis: TokenAnalysis): Promise<Prediction>;
}
