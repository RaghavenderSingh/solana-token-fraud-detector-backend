// token-analyzer-v3.js - Improved with better risk logic and whitelisting
require('dotenv').config();
const axios = require('axios');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const API_BASE = 'https://api.helius.xyz/v0';
const RPC_BASE = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Whitelist of known safe tokens (even with active authorities)
const KNOWN_SAFE_TOKENS = {
  'So11111111111111111111111111111111111111112': {
    name: 'Wrapped SOL',
    symbol: 'SOL',
    reason: 'Native SOL wrapper - official Solana token',
    riskOverride: 'LOW'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    symbol: 'USDC',
    reason: 'Circle-issued regulated stablecoin',
    riskOverride: 'LOW'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'Tether USD',
    symbol: 'USDT',
    reason: 'Tether-issued regulated stablecoin',
    riskOverride: 'LOW'
  },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    name: 'Bonk',
    symbol: 'BONK',
    reason: 'Established community meme token',
    riskOverride: 'LOW'
  },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    name: 'Jupiter',
    symbol: 'JUP',
    reason: 'Jupiter DEX governance token',
    riskOverride: 'LOW'
  }
};

class TokenTrustAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.riskWeights = {
      MINT_AUTHORITY: 40,
      FREEZE_AUTHORITY: 30,
      TOKEN_AGE: 25,
      TRANSACTION_VOLUME: 15,
      CREATOR_BEHAVIOR: 20,
      METADATA_QUALITY: 10
    };
  }

  /**
   * Main analysis function with improved logic
   */
  async analyzeToken(tokenAddress) {
    console.log(`\n🚀 TOKENTRUST ANALYSIS: ${tokenAddress}`);
    console.log('='.repeat(70));

    const analysis = {
      tokenAddress,
      timestamp: new Date().toISOString(),
      tokenInfo: null,
      mintInfo: null,
      transactionData: null,
      creatorData: null,
      isWhitelisted: false,
      whitelistInfo: null,
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      riskFactors: [],
      safetyFactors: [],
      recommendations: []
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
      console.log('\n📄 Step 1: Fetching token metadata...');
      analysis.tokenInfo = await this.getTokenMetadata(tokenAddress);

      // Step 2: Get mint info
      console.log('\n🔧 Step 2: Checking mint authorities...');
      analysis.mintInfo = await this.getMintInfo(tokenAddress);

      // Step 3: Analyze transactions with improved time calculation
      console.log('\n📊 Step 3: Analyzing transaction patterns...');
      analysis.transactionData = await this.analyzeTransactions(tokenAddress);

      // Step 4: Creator analysis
      console.log('\n👤 Step 4: Analyzing creator behavior...');
      analysis.creatorData = await this.analyzeCreator(analysis.transactionData);

      // Step 5: Calculate risk with whitelist consideration
      console.log('\n⚠️ Step 5: Calculating risk assessment...');
      this.calculateImprovedRiskScore(analysis);

      console.log('\n✅ Analysis complete!');
      this.printDetailedSummary(analysis);

      return analysis;

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      analysis.riskFactors.push('Technical analysis failed');
      analysis.riskScore = analysis.isWhitelisted ? 20 : 75;
      analysis.riskLevel = analysis.isWhitelisted ? 'LOW' : 'HIGH';
      return analysis;
    }
  }

  /**
   * Get token metadata using DAS
   */
  async getTokenMetadata(tokenAddress) {
    try {
      const response = await axios.post(RPC_BASE, {
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: tokenAddress }
      });

      const result = response.data?.result;
      if (!result) {
        console.log('   ⚠️ No metadata found');
        return null;
      }

      const tokenInfo = {
        name: result.content?.metadata?.name || 'Unknown',
        symbol: result.content?.metadata?.symbol || 'Unknown',
        image: result.content?.links?.image || null,
        supply: result.token_info?.supply || 0,
        decimals: result.token_info?.decimals || 0,
        priceInfo: result.token_info?.price_info || null,
        interface: result.interface || 'Unknown',
        mutable: result.mutable || false
      };

      console.log(`   ✅ Found: ${tokenInfo.name} (${tokenInfo.symbol})`);
      if (tokenInfo.priceInfo) {
        console.log(`   💰 Price: $${tokenInfo.priceInfo.price_per_token} ${tokenInfo.priceInfo.currency}`);
      }

      return tokenInfo;
    } catch (error) {
      console.log('   ❌ Metadata fetch failed');
      return null;
    }
  }

  /**
   * Get mint authority info
   */
  async getMintInfo(tokenAddress) {
    try {
      const response = await axios.post(RPC_BASE, {
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [tokenAddress, { encoding: "jsonParsed" }]
      });

      const accountInfo = response.data?.result?.value;
      if (!accountInfo?.data?.parsed) {
        console.log('   ⚠️ Not a valid SPL token');
        return null;
      }

      const mintData = accountInfo.data.parsed.info;
      const mintRevoked = !mintData.mintAuthority || mintData.mintAuthority === '11111111111111111111111111111111';
      const freezeRevoked = !mintData.freezeAuthority || mintData.freezeAuthority === '11111111111111111111111111111111';

      console.log(`   🔑 Mint Authority: ${mintRevoked ? '✅ Revoked' : '❌ Active'}`);
      console.log(`   🧊 Freeze Authority: ${freezeRevoked ? '✅ Revoked' : '❌ Active'}`);
      
      const actualSupply = parseInt(mintData.supply) / Math.pow(10, mintData.decimals);
      console.log(`   📊 Supply: ${actualSupply.toLocaleString()}`);

      return {
        decimals: mintData.decimals,
        supply: mintData.supply,
        actualSupply,
        mintAuthority: mintData.mintAuthority,
        freezeAuthority: mintData.freezeAuthority,
        mintRevoked,
        freezeRevoked
      };
    } catch (error) {
      console.log('   ❌ Mint info fetch failed');
      return null;
    }
  }

  /**
   * Analyze transactions with better time calculation
   */
  async analyzeTransactions(tokenAddress, limit = 100) {
    try {
      const response = await axios.get(`${API_BASE}/addresses/${tokenAddress}/transactions`, {
        params: {
          'api-key': this.apiKey,
          limit
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        return this.getEmptyTransactionAnalysis();
      }

      const transactions = response.data;
      console.log(`   📈 Analyzing ${transactions.length} transactions`);

      // Better time calculation - look for actual creation
      const timeSpan = this.calculateImprovedTimeSpan(transactions);
      const transferPatterns = this.analyzeTransferPatterns(transactions);
      const accountActivity = this.analyzeAccountActivity(transactions);
      const suspiciousActivity = this.detectSuspiciousActivity(transactions);

      console.log(`   ⏱️ Token age: ${timeSpan.estimatedAgeDays} days (based on oldest transaction)`);
      console.log(`   👥 Unique accounts: ${accountActivity.uniqueAccounts}`);
      console.log(`   🔄 Token transfers: ${transferPatterns.tokenTransferCount}`);

      return {
        totalTransactions: transactions.length,
        timeSpan,
        transferPatterns,
        accountActivity,
        suspiciousActivity,
        rawTransactions: transactions.slice(0, 5) // Keep some for analysis
      };
    } catch (error) {
      console.log('   ❌ Transaction analysis failed');
      return this.getEmptyTransactionAnalysis();
    }
  }

  /**
   * Improved time calculation - estimate token age better
   */
  calculateImprovedTimeSpan(transactions) {
    if (transactions.length === 0) {
      return { estimatedAgeDays: 0, confidence: 'none' };
    }

    // Sort by timestamp to find oldest
    const sortedTxs = transactions.sort((a, b) => a.timestamp - b.timestamp);
    const oldest = sortedTxs[0];
    const newest = sortedTxs[sortedTxs.length - 1];
    
    const ageInSeconds = Date.now() / 1000 - oldest.timestamp;
    const estimatedAgeDays = Math.floor(ageInSeconds / (24 * 60 * 60));
    
    // Confidence based on how many transactions we have
    let confidence = 'low';
    if (transactions.length >= 50) confidence = 'high';
    else if (transactions.length >= 20) confidence = 'medium';

    // If we hit the limit, likely older than calculated
    const probablyOlder = transactions.length >= 100;

    return {
      estimatedAgeDays: probablyOlder ? Math.max(estimatedAgeDays, 30) : estimatedAgeDays,
      confidence,
      probablyOlder,
      oldestTx: new Date(oldest.timestamp * 1000).toISOString(),
      newestTx: new Date(newest.timestamp * 1000).toISOString()
    };
  }

  /**
   * Analyze transfer patterns
   */
  analyzeTransferPatterns(transactions) {
    let tokenTransferCount = 0;
    let nativeTransferCount = 0;
    let unknownTypes = 0;
    let swapActivity = 0;

    transactions.forEach(tx => {
      if (tx.tokenTransfers?.length > 0) tokenTransferCount++;
      if (tx.nativeTransfers?.length > 0) nativeTransferCount++;
      if (tx.type === 'UNKNOWN') unknownTypes++;
      if (tx.type === 'SWAP' || tx.description?.toLowerCase().includes('swap')) swapActivity++;
    });

    return {
      tokenTransferCount,
      nativeTransferCount,
      unknownTypes,
      swapActivity,
      unknownRatio: unknownTypes / transactions.length,
      swapRatio: swapActivity / transactions.length,
      tokenActivityRatio: tokenTransferCount / transactions.length
    };
  }

  /**
   * Analyze account activity
   */
  analyzeAccountActivity(transactions) {
    const uniqueAccounts = new Set();
    const feePayers = new Set();

    transactions.forEach(tx => {
      if (tx.feePayer) feePayers.add(tx.feePayer);
      tx.accountData?.forEach(acc => uniqueAccounts.add(acc.account));
    });

    return {
      uniqueAccounts: uniqueAccounts.size,
      uniqueFeePayers: feePayers.size,
      accountDiversity: feePayers.size / Math.max(transactions.length, 1)
    };
  }

  /**
   * Detect suspicious patterns
   */
  detectSuspiciousActivity(transactions) {
    const patterns = [];

    const unknownRatio = transactions.filter(tx => tx.type === 'UNKNOWN').length / transactions.length;
    if (unknownRatio > 0.8) {
      patterns.push('Very high ratio of unknown transaction types');
    }

    const tokenTxRatio = transactions.filter(tx => tx.tokenTransfers?.length > 0).length / transactions.length;
    if (tokenTxRatio < 0.1) {
      patterns.push('Very few actual token transfers');
    }

    const uniqueFeePayers = new Set(transactions.map(tx => tx.feePayer)).size;
    if (uniqueFeePayers === 1 && transactions.length > 10) {
      patterns.push('All transactions from single account');
    }

    return patterns;
  }

  /**
   * Analyze creator behavior
   */
  async analyzeCreator(transactionData) {
    if (!transactionData) return { riskScore: 0, patterns: [] };

    const patterns = [];
    let riskScore = 0;

    if (transactionData.accountActivity.accountDiversity < 0.2) {
      patterns.push('Very low account diversity');
      riskScore += 15;
    }

    patterns.push(...transactionData.suspiciousActivity);
    riskScore += transactionData.suspiciousActivity.length * 10;

    return { riskScore, patterns };
  }

  /**
   * Calculate improved risk score with whitelist logic
   */
  calculateImprovedRiskScore(analysis) {
    let totalRisk = 0;
    const factors = [];
    const safetyFactors = [];

    // If whitelisted, apply special logic
    if (analysis.isWhitelisted) {
      const override = analysis.whitelistInfo.riskOverride;
      
      safetyFactors.push(`🏆 VERIFIED TOKEN: ${analysis.whitelistInfo.reason}`);
      
      // Even whitelisted tokens get some base checks
      if (analysis.mintInfo && !analysis.mintInfo.mintRevoked) {
        factors.push('⚠️ Mint authority active (but expected for this token type)');
        totalRisk += 5; // Much lower penalty for whitelisted
      }
      if (analysis.mintInfo && !analysis.mintInfo.freezeRevoked) {
        factors.push('⚠️ Freeze authority active (but expected for regulated token)');
        totalRisk += 5;
      }

      // Override risk level for whitelisted tokens
      totalRisk = Math.min(totalRisk, override === 'LOW' ? 25 : 45);
      
    } else {
      // Standard risk calculation for non-whitelisted tokens
      
      // Authority risks
      if (analysis.mintInfo) {
        if (!analysis.mintInfo.mintRevoked) {
          totalRisk += this.riskWeights.MINT_AUTHORITY;
          factors.push('🚨 Mint authority NOT revoked - unlimited token creation possible');
        } else {
          safetyFactors.push('✅ Mint authority properly revoked');
        }

        if (!analysis.mintInfo.freezeRevoked) {
          totalRisk += this.riskWeights.FREEZE_AUTHORITY;
          factors.push('🧊 Freeze authority active - accounts can be frozen');
        } else {
          safetyFactors.push('✅ Freeze authority revoked');
        }
      }

      // Age-based risk (improved)
      if (analysis.transactionData?.timeSpan) {
        const age = analysis.transactionData.timeSpan.estimatedAgeDays;
        if (age < 7) {
          totalRisk += this.riskWeights.TOKEN_AGE;
          factors.push(`🕐 Very new token (≤${age} days old)`);
        } else if (age < 30) {
          totalRisk += this.riskWeights.TOKEN_AGE * 0.5;
          factors.push(`⏱️ Recent token (~${age} days old)`);
        } else {
          safetyFactors.push(`⏳ Established token (${age}+ days active)`);
        }
      }

      // Transaction volume
      if (analysis.transactionData) {
        if (analysis.transactionData.totalTransactions < 50) {
          totalRisk += this.riskWeights.TRANSACTION_VOLUME;
          factors.push(`📉 Low transaction volume (${analysis.transactionData.totalTransactions})`);
        } else {
          safetyFactors.push(`📈 Good transaction activity (${analysis.transactionData.totalTransactions})`);
        }
      }

      // Creator behavior
      if (analysis.creatorData?.riskScore > 0) {
        totalRisk += analysis.creatorData.riskScore;
        factors.push(...analysis.creatorData.patterns);
      }
    }

    // Metadata quality (applies to all)
    if (analysis.tokenInfo) {
      if (analysis.tokenInfo.name === 'Unknown' || analysis.tokenInfo.symbol === 'Unknown') {
        totalRisk += this.riskWeights.METADATA_QUALITY;
        factors.push('📝 Missing token metadata');
      } else {
        safetyFactors.push('📋 Complete token metadata');
      }

      if (analysis.tokenInfo.priceInfo) {
        safetyFactors.push(`💰 Live price data available`);
      }
    }

    // Cap and determine level
    totalRisk = Math.min(totalRisk, 100);

    let riskLevel;
    if (totalRisk < 30) riskLevel = 'LOW';
    else if (totalRisk < 55) riskLevel = 'MODERATE';
    else if (totalRisk < 80) riskLevel = 'HIGH';
    else riskLevel = 'CRITICAL';

    // Generate recommendations
    const recommendations = this.generateImprovedRecommendations(totalRisk, analysis.isWhitelisted);

    // Update analysis
    analysis.riskScore = totalRisk;
    analysis.riskLevel = riskLevel;
    analysis.riskFactors = factors;
    analysis.safetyFactors = safetyFactors;
    analysis.recommendations = recommendations;
  }

  /**
   * Generate improved recommendations
   */
  generateImprovedRecommendations(riskScore, isWhitelisted) {
    const recommendations = [];

    if (isWhitelisted) {
      recommendations.push('✅ VERIFIED: This is a known legitimate token');
      if (riskScore < 15) {
        recommendations.push('💡 Safe for normal usage and trading');
      } else {
        recommendations.push('💡 Generally safe, but note any specific warnings above');
      }
    } else if (riskScore < 30) {
      recommendations.push('✅ LOW RISK: Token appears relatively safe');
      recommendations.push('💡 Standard due diligence recommended');
    } else if (riskScore < 55) {
      recommendations.push('⚠️ MODERATE RISK: Exercise caution');
      recommendations.push('💡 Research project thoroughly before investing');
      recommendations.push('💡 Consider smaller position sizes');
    } else if (riskScore < 80) {
      recommendations.push('🚨 HIGH RISK: Be very careful');
      recommendations.push('💡 Multiple red flags detected');
      recommendations.push('💡 Only invest what you can afford to lose');
      recommendations.push('💡 Wait for more transaction history if possible');
    } else {
      recommendations.push('🛑 CRITICAL RISK: Strongly avoid');
      recommendations.push('💡 High probability of scam or rug pull');
      recommendations.push('💡 Consider this token dangerous');
    }

    return recommendations;
  }

  /**
   * Print improved summary
   */
  printDetailedSummary(analysis) {
    console.log('\n' + '='.repeat(70));
    console.log('📋 TOKENTRUST RISK ASSESSMENT REPORT');
    console.log('='.repeat(70));
    
    const name = analysis.tokenInfo?.name || 'Unknown';
    const symbol = analysis.tokenInfo?.symbol || 'Unknown';
    console.log(`🪙 Token: ${name} (${symbol})`);
    
    if (analysis.isWhitelisted) {
      console.log(`🏆 Status: VERIFIED TOKEN`);
      console.log(`📝 Note: ${analysis.whitelistInfo.reason}`);
    }
    
    console.log(`📍 Address: ${analysis.tokenAddress}`);
    
    if (analysis.tokenInfo?.priceInfo) {
      console.log(`💰 Price: $${analysis.tokenInfo.priceInfo.price_per_token} ${analysis.tokenInfo.priceInfo.currency}`);
    }

    // Risk score with color coding
    const riskEmoji = {
      'LOW': '🟢',
      'MODERATE': '🟡', 
      'HIGH': '🟠',
      'CRITICAL': '🔴'
    };
    
    console.log(`\n🎯 RISK SCORE: ${analysis.riskScore}/100`);
    console.log(`${riskEmoji[analysis.riskLevel]} Risk Level: ${analysis.riskLevel}`);

    // Safety factors
    if (analysis.safetyFactors.length > 0) {
      console.log('\n✅ SAFETY FACTORS:');
      analysis.safetyFactors.forEach(factor => console.log(`   ${factor}`));
    }

    // Risk factors
    if (analysis.riskFactors.length > 0) {
      console.log('\n⚠️ RISK FACTORS:');
      analysis.riskFactors.forEach(factor => console.log(`   ${factor}`));
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    analysis.recommendations.forEach(rec => console.log(`   ${rec}`));

    console.log('\n' + '='.repeat(70));
    console.log(`📅 Analysis completed: ${new Date().toLocaleString()}`);
    console.log('='.repeat(70));
  }

  /**
   * Empty analysis helper
   */
  getEmptyTransactionAnalysis() {
    return {
      totalTransactions: 0,
      timeSpan: { estimatedAgeDays: 0, confidence: 'none' },
      transferPatterns: { tokenTransferCount: 0, unknownRatio: 1 },
      accountActivity: { uniqueAccounts: 0, accountDiversity: 0 },
      suspiciousActivity: ['No transaction data available']
    };
  }
}

// Test with improved analyzer
async function runImprovedTest() {
  if (!HELIUS_API_KEY) {
    console.error('❌ Please set HELIUS_API_KEY in your .env file');
    return;
  }

  const analyzer = new TokenTrustAnalyzer(HELIUS_API_KEY);

  const testTokens = [
    {
      name: 'Wrapped SOL',
      address: 'So11111111111111111111111111111111111111112',
      expected: 'LOW (whitelisted)'
    },
    {
      name: 'USDC',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      expected: 'LOW (whitelisted)'
    },
    {
      name: 'BONK',
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      expected: 'LOW (whitelisted)'
    }
  ];

  console.log('🚀 TOKENTRUST V3 - IMPROVED ANALYSIS');
  console.log('Testing with whitelist and better risk logic...\n');

  for (const token of testTokens) {
    try {
      const analysis = await analyzer.analyzeToken(token.address);
      
      console.log(`\n📊 Expected: ${token.expected} | Actual: ${analysis.riskLevel}${analysis.isWhitelisted ? ' (VERIFIED)' : ''}`);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`❌ Failed to analyze ${token.name}:`, error.message);
    }
  }

  console.log('\n🎉 Improved testing complete!');
  console.log('\n🔍 Key improvements:');
  console.log('   ✅ Whitelist system for known tokens');
  console.log('   ✅ Better age calculation');
  console.log('   ✅ Improved risk scoring logic');
  console.log('   ✅ More accurate risk assessments');
}

if (require.main === module) {
  runImprovedTest().catch(console.error);
}

module.exports = TokenTrustAnalyzer;