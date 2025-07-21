import axios from "axios";
import logger from "../utils/logger";

interface GeminiConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

interface TokenAnalysisData {
  token: any;
  verification: any;
  security: any;
  transactions: any;
  dexData: any;
  riskAssessment: any;
  recommendations: any[];
}

export class GeminiService {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-1.5-flash";
    this.maxTokens = config.maxTokens || 2048;
  }

  async analyzeTokenWithAI(analysisData: TokenAnalysisData): Promise<any> {
    try {
      const prompt = this.buildAnalysisPrompt(analysisData);

      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: 0.3,
            topP: 0.8,
            topK: 40,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const aiResponse =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error("No response from Gemini AI");
      }

      return this.parseAIResponse(aiResponse, analysisData);
    } catch (error) {
      logger.error("Gemini AI analysis failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        tokenAddress: analysisData.token.address,
      });

      // Return fallback analysis if AI fails
      return this.generateFallbackAnalysis(analysisData);
    }
  }

  private buildAnalysisPrompt(analysisData: TokenAnalysisData): string {
    return `
You are a DeFi security expert analyzing a Solana token. Please provide a comprehensive analysis based on the following data:

TOKEN INFORMATION:
- Name: ${analysisData.token.name}
- Symbol: ${analysisData.token.symbol}
- Address: ${analysisData.token.address}
- Price: $${analysisData.token.price}
- Decimals: ${analysisData.token.decimals}

VERIFICATION STATUS:
- Status: ${analysisData.verification.status}
- Confidence: ${analysisData.verification.confidence}%
- Sources: ${analysisData.verification.sources.join(", ")}
- Description: ${analysisData.verification.description}

SECURITY ANALYSIS:
- Mint Authority: ${analysisData.security.mintAuthority}
- Freeze Authority: ${analysisData.security.freezeAuthority}
- Is Locked: ${analysisData.security.isLocked}

TRANSACTION ANALYSIS:
- Total Transactions: ${analysisData.transactions.total}
- Days Active: ${analysisData.transactions.daysActive} days (${analysisData.transactions.daysActive < 30 ? "NEW TOKEN" : analysisData.transactions.daysActive < 365 ? "ESTABLISHED" : "LONG-TERM"})
- Transfer Patterns: ${analysisData.transactions.transferPatterns.normal ? "Normal" : "Suspicious"}
- Account Activity: ${analysisData.transactions.accountActivity.active ? "Active" : "Inactive"}
- Creator Behavior: ${analysisData.transactions.accountActivity.creatorBehavior}

DEX DATA:
- Total Liquidity: $${analysisData.dexData.liquidity.total}
- Daily Volume: $${analysisData.dexData.volume.daily}
- Current Price: $${analysisData.dexData.price.current}
- Number of Pools: ${analysisData.dexData.pools.count}
- Exchanges: ${analysisData.dexData.pools.exchanges.join(", ")}

VOLUME-TO-LIQUIDITY ANALYSIS:
- Volume/Liquidity Ratio: ${analysisData.dexData.volume.daily > 0 && analysisData.dexData.liquidity.total > 0 ? (analysisData.dexData.volume.daily / analysisData.dexData.liquidity.total).toFixed(2) + "x" : "N/A"}
- This ratio indicates: ${this.getVolumeLiquidityContext(analysisData)}

RISK ASSESSMENT:
- Risk Score: ${analysisData.riskAssessment.score}/100
- Risk Level: ${analysisData.riskAssessment.level}
- Safety Factors: ${analysisData.riskAssessment.factors.safety.join(", ")}
- Risk Factors: ${analysisData.riskAssessment.factors.risk.join(", ")}

CURRENT RECOMMENDATIONS:
${analysisData.recommendations.map((rec) => `- ${rec}`).join("\n")}

IMPORTANT: When analyzing token age, use these guidelines:
- NEW TOKEN: Less than 30 days old (higher risk)
- ESTABLISHED: 30 days to 1 year old (moderate risk)
- LONG-TERM: More than 1 year old (lower risk)

VOLUME-TO-LIQUIDITY CONTEXT ANALYSIS:
Please specifically analyze the volume-to-liquidity ratio and provide context about whether this pattern is:
1. LEGITIMATE: High-frequency trading in DeFi protocols, arbitrage, legitimate market making
2. SUSPICIOUS: Potential wash trading, artificial volume inflation, pump and dump schemes
3. NORMAL: Standard trading patterns for this type of token

Consider factors like:
- Token type (stablecoin, governance, utility, meme)
- Verification status and trust level
- Age and establishment of the token
- Number of DEX pools and exchanges
- Historical trading patterns

Please provide:
1. A concise summary of the token's legitimacy
2. Key risk factors and their implications
3. Investment recommendations (SAFE, CAUTION, AVOID)
4. Specific warnings or positive indicators
5. A confidence score for your assessment (0-100)
6. Volume-to-liquidity ratio context (LEGITIMATE/SUSPICIOUS/NORMAL)

Format your response as JSON with the following structure:
{
  "summary": "Brief overview of the token",
  "legitimacy": "LEGITIMATE|SUSPICIOUS|SCAM",
  "riskFactors": ["factor1", "factor2"],
  "positiveIndicators": ["indicator1", "indicator2"],
  "investmentRecommendation": "SAFE|CAUTION|AVOID",
  "confidence": 85,
  "warnings": ["warning1", "warning2"],
  "volumeLiquidityContext": "LEGITIMATE|SUSPICIOUS|NORMAL",
  "volumeLiquidityExplanation": "Detailed explanation of the volume-to-liquidity pattern",
  "aiInsights": "Detailed AI analysis and reasoning"
}
`;
  }

  private getVolumeLiquidityContext(analysisData: TokenAnalysisData): string {
    if (
      analysisData.dexData.volume.daily === 0 ||
      analysisData.dexData.liquidity.total === 0
    ) {
      return "Insufficient data";
    }

    const ratio =
      analysisData.dexData.volume.daily / analysisData.dexData.liquidity.total;

    if (ratio > 10) {
      return "EXTREMELY HIGH - Potential manipulation or legitimate high-frequency trading";
    } else if (ratio > 5) {
      return "HIGH - Suspicious but could be legitimate for established tokens";
    } else if (ratio > 2) {
      return "MODERATE - Normal for active trading tokens";
    } else {
      return "LOW - Normal trading activity";
    }
  }

  private parseAIResponse(
    aiResponse: string,
    originalData: TokenAnalysisData
  ): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          originalAnalysis: originalData,
          aiResponse: aiResponse,
          timestamp: new Date().toISOString(),
        };
      }

      // If no JSON found, return structured response
      return {
        summary: "AI analysis completed",
        legitimacy: this.determineLegitimacy(originalData),
        riskFactors: originalData.riskAssessment.factors.risk,
        positiveIndicators: originalData.riskAssessment.factors.safety,
        investmentRecommendation:
          this.getInvestmentRecommendation(originalData),
        confidence: originalData.verification.confidence,
        warnings: [],
        aiInsights: aiResponse,
        originalAnalysis: originalData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to parse Gemini AI response", { error });
      return this.generateFallbackAnalysis(originalData);
    }
  }

  private generateFallbackAnalysis(analysisData: TokenAnalysisData): any {
    return {
      summary: "AI analysis unavailable - using automated assessment",
      legitimacy: this.determineLegitimacy(analysisData),
      riskFactors: analysisData.riskAssessment.factors.risk,
      positiveIndicators: analysisData.riskAssessment.factors.safety,
      investmentRecommendation: this.getInvestmentRecommendation(analysisData),
      confidence: analysisData.verification.confidence,
      warnings: ["AI analysis temporarily unavailable"],
      aiInsights:
        "Automated risk assessment based on on-chain data and DEX analysis",
      originalAnalysis: analysisData,
      timestamp: new Date().toISOString(),
    };
  }

  private determineLegitimacy(analysisData: TokenAnalysisData): string {
    if (
      analysisData.verification.status === "VERIFIED" &&
      analysisData.verification.confidence >= 90
    ) {
      return "LEGITIMATE";
    }
    if (analysisData.riskAssessment.score <= 20) {
      return "LEGITIMATE";
    }
    if (analysisData.riskAssessment.score >= 70) {
      return "SCAM";
    }
    return "SUSPICIOUS";
  }

  private getInvestmentRecommendation(analysisData: TokenAnalysisData): string {
    if (analysisData.riskAssessment.score <= 20) {
      return "SAFE";
    }
    if (analysisData.riskAssessment.score <= 50) {
      return "CAUTION";
    }
    return "AVOID";
  }

  async getEnhancedRecommendations(
    analysisData: TokenAnalysisData
  ): Promise<string[]> {
    try {
      const prompt = `
Based on this token analysis, provide 3-5 specific, actionable recommendations for investors:

Token: ${analysisData.token.name} (${analysisData.token.symbol})
Risk Score: ${analysisData.riskAssessment.score}/100
Risk Level: ${analysisData.riskAssessment.level}
Verification: ${analysisData.verification.status}

Provide recommendations in this format:
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]
`;

      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.2,
          },
        }
      );

      const aiResponse =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return aiResponse
        ? aiResponse.split("\n").filter((line: string) => line.trim())
        : [];
    } catch (error) {
      logger.error("Failed to get enhanced recommendations", { error });
      return analysisData.recommendations;
    }
  }
}
