import axios from "axios";
import { TokenMetadata } from "../types";

export interface SocialMediaAnalysis {
  hasTwitter: boolean;
  hasTelegram: boolean;
  hasDiscord: boolean;
  hasWebsite: boolean;
  hasGitHub: boolean;
  twitterMetrics?: {
    followers: number;
    following: number;
    tweets: number;
    accountAge: number;
    verified: boolean;
    lastActive: string;
  };
  telegramMetrics?: {
    members: number;
    online: number;
    messages: number;
    groupAge: number;
  };
  discordMetrics?: {
    members: number;
    online: number;
    channels: number;
    serverAge: number;
  };
  websiteMetrics?: {
    domainAge: number;
    hasSSL: boolean;
    hasPrivacyPolicy: boolean;
    hasTermsOfService: boolean;
    socialLinks: string[];
  };
  githubMetrics?: {
    repositories: number;
    stars: number;
    forks: number;
    contributors: number;
    lastCommit: string;
  };
  overallScore: number;
  legitimacySignals: string[];
  redFlags: string[];
}

export class SocialMediaService {
  private readonly TWITTER_API_BASE = "https://api.twitter.com/2";
  private readonly TELEGRAM_API_BASE = "https://api.telegram.org/bot";
  private readonly DISCORD_API_BASE = "https://discord.com/api/v10";
  private readonly GITHUB_API_BASE = "https://api.github.com";

  constructor(
    private twitterBearerToken?: string,
    private telegramBotToken?: string,
    private discordBotToken?: string,
    private githubToken?: string
  ) {}

  /**
   * Comprehensive social media analysis for token legitimacy
   */
  async analyzeTokenSocialMedia(
    tokenAddress: string,
    metadata?: TokenMetadata
  ): Promise<SocialMediaAnalysis> {
    const analysis: SocialMediaAnalysis = {
      hasTwitter: false,
      hasTelegram: false,
      hasDiscord: false,
      hasWebsite: false,
      hasGitHub: false,
      overallScore: 0,
      legitimacySignals: [],
      redFlags: [],
    };

    try {
      // Extract social media links from metadata
      const socialLinks = this.extractSocialLinks(metadata);

      // Analyze each platform
      const [
        twitterAnalysis,
        telegramAnalysis,
        discordAnalysis,
        websiteAnalysis,
        githubAnalysis,
      ] = await Promise.allSettled([
        this.analyzeTwitter(socialLinks.twitter),
        this.analyzeTelegram(socialLinks.telegram),
        this.analyzeDiscord(socialLinks.discord),
        this.analyzeWebsite(socialLinks.website),
        this.analyzeGitHub(socialLinks.github),
      ]);

      // Process Twitter results
      if (twitterAnalysis.status === "fulfilled" && twitterAnalysis.value) {
        analysis.hasTwitter = true;
        analysis.twitterMetrics = twitterAnalysis.value;
        this.evaluateTwitterLegitimacy(analysis, twitterAnalysis.value);
      }

      // Process Telegram results
      if (telegramAnalysis.status === "fulfilled" && telegramAnalysis.value) {
        analysis.hasTelegram = true;
        analysis.telegramMetrics = telegramAnalysis.value;
        this.evaluateTelegramLegitimacy(analysis, telegramAnalysis.value);
      }

      // Process Discord results
      if (discordAnalysis.status === "fulfilled" && discordAnalysis.value) {
        analysis.hasDiscord = true;
        analysis.discordMetrics = discordAnalysis.value;
        this.evaluateDiscordLegitimacy(analysis, discordAnalysis.value);
      }

      // Process Website results
      if (websiteAnalysis.status === "fulfilled" && websiteAnalysis.value) {
        analysis.hasWebsite = true;
        analysis.websiteMetrics = websiteAnalysis.value;
        this.evaluateWebsiteLegitimacy(analysis, websiteAnalysis.value);
      }

      // Process GitHub results
      if (githubAnalysis.status === "fulfilled" && githubAnalysis.value) {
        analysis.hasGitHub = true;
        analysis.githubMetrics = githubAnalysis.value;
        this.evaluateGitHubLegitimacy(analysis, githubAnalysis.value);
      }

      // Calculate overall score
      analysis.overallScore = this.calculateOverallScore(analysis);

      return analysis;
    } catch (error) {
      console.error("Social media analysis failed:", error);
      return analysis;
    }
  }

  /**
   * Extract social media links from token metadata
   */
  private extractSocialLinks(metadata?: TokenMetadata): {
    twitter?: string;
    telegram?: string;
    discord?: string;
    website?: string;
    github?: string;
  } {
    const links: any = {};

    if (!metadata) return links;

    // Extract from external URL
    if (metadata.externalUrl) {
      const url = metadata.externalUrl.toLowerCase();

      if (url.includes("twitter.com") || url.includes("x.com")) {
        links.twitter = metadata.externalUrl;
      } else if (url.includes("t.me") || url.includes("telegram.me")) {
        links.telegram = metadata.externalUrl;
      } else if (url.includes("discord.gg") || url.includes("discord.com")) {
        links.discord = metadata.externalUrl;
      } else if (url.includes("github.com")) {
        links.github = metadata.externalUrl;
      } else {
        links.website = metadata.externalUrl;
      }
    }

    // Extract from description
    if (metadata.description) {
      const description = metadata.description.toLowerCase();

      // Twitter patterns
      const twitterMatch = description.match(
        /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/
      );
      if (twitterMatch && !links.twitter) {
        links.twitter = `https://twitter.com/${twitterMatch[1]}`;
      }

      // Telegram patterns
      const telegramMatch = description.match(
        /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/
      );
      if (telegramMatch && !links.telegram) {
        links.telegram = `https://t.me/${telegramMatch[1]}`;
      }

      // Discord patterns
      const discordMatch = description.match(/discord\.gg\/([a-zA-Z0-9]+)/);
      if (discordMatch && !links.discord) {
        links.discord = `https://discord.gg/${discordMatch[1]}`;
      }

      // GitHub patterns
      const githubMatch = description.match(
        /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/
      );
      if (githubMatch && !links.github) {
        links.github = `https://github.com/${githubMatch[1]}`;
      }
    }

    return links;
  }

  /**
   * Analyze Twitter presence
   */
  private async analyzeTwitter(twitterUrl?: string): Promise<any> {
    if (!twitterUrl || !this.twitterBearerToken) return null;

    try {
      // Extract username from URL
      const username = twitterUrl.match(
        /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/
      )?.[1];
      if (!username) return null;

      const response = await axios.get(
        `${this.TWITTER_API_BASE}/users/by/username/${username}?user.fields=public_metrics,created_at,verified`,
        {
          headers: {
            Authorization: `Bearer ${this.twitterBearerToken}`,
          },
          timeout: 10000,
        }
      );

      const user = response.data.data;
      if (!user) return null;

      const accountAge = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return {
        followers: user.public_metrics.followers_count,
        following: user.public_metrics.following_count,
        tweets: user.public_metrics.tweet_count,
        accountAge,
        verified: user.verified,
        lastActive: user.created_at,
      };
    } catch (error) {
      console.log(
        "Twitter analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  }

  /**
   * Analyze Telegram presence
   */
  private async analyzeTelegram(telegramUrl?: string): Promise<any> {
    if (!telegramUrl || !this.telegramBotToken) return null;

    try {
      // Extract channel/group name from URL
      const channelName = telegramUrl.match(
        /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/
      )?.[1];
      if (!channelName) return null;

      const response = await axios.get(
        `${this.TELEGRAM_API_BASE}${this.telegramBotToken}/getChat?chat_id=@${channelName}`,
        { timeout: 10000 }
      );

      const chat = response.data.result;
      if (!chat) return null;

      // Get chat member count
      const memberResponse = await axios.get(
        `${this.TELEGRAM_API_BASE}${this.telegramBotToken}/getChatMemberCount?chat_id=@${channelName}`,
        { timeout: 10000 }
      );

      return {
        members: memberResponse.data.result || 0,
        online: 0, // Telegram doesn't provide this via API
        messages: 0, // Would need to scrape for this
        groupAge: Math.floor(
          (Date.now() - chat.date * 1000) / (1000 * 60 * 60 * 24)
        ),
      };
    } catch (error) {
      console.log(
        "Telegram analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  }

  /**
   * Analyze Discord presence
   */
  private async analyzeDiscord(discordUrl?: string): Promise<any> {
    if (!discordUrl || !this.discordBotToken) return null;

    try {
      // Extract invite code from URL
      const inviteCode = discordUrl.match(/discord\.gg\/([a-zA-Z0-9]+)/)?.[1];
      if (!inviteCode) return null;

      const response = await axios.get(
        `${this.DISCORD_API_BASE}/invites/${inviteCode}?with_counts=true`,
        {
          headers: {
            Authorization: `Bot ${this.discordBotToken}`,
          },
          timeout: 10000,
        }
      );

      const invite = response.data;
      if (!invite) return null;

      return {
        members: invite.approximate_member_count || 0,
        online: invite.approximate_presence_count || 0,
        channels: invite.guild?.channels?.length || 0,
        serverAge: Math.floor(
          (Date.now() -
            new Date(invite.guild?.created_at || Date.now()).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      };
    } catch (error) {
      console.log(
        "Discord analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  }

  /**
   * Analyze website presence
   */
  private async analyzeWebsite(websiteUrl?: string): Promise<any> {
    if (!websiteUrl) return null;

    try {
      const response = await axios.get(websiteUrl, {
        timeout: 10000,
        validateStatus: () => true, // Don't throw on non-2xx status codes
      });

      const html = response.data;
      const domain = new URL(websiteUrl).hostname;

      // Check for SSL
      const hasSSL = websiteUrl.startsWith("https://");

      // Check for privacy policy and terms
      const hasPrivacyPolicy =
        html.toLowerCase().includes("privacy") ||
        html.toLowerCase().includes("privacy policy");
      const hasTermsOfService =
        html.toLowerCase().includes("terms") ||
        html.toLowerCase().includes("terms of service");

      // Extract social media links from website
      const socialLinks = this.extractSocialLinksFromHTML(html);

      return {
        domainAge: 0, // Would need WHOIS lookup
        hasSSL,
        hasPrivacyPolicy,
        hasTermsOfService,
        socialLinks,
      };
    } catch (error) {
      console.log(
        "Website analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  }

  /**
   * Analyze GitHub presence
   */
  private async analyzeGitHub(githubUrl?: string): Promise<any> {
    if (!githubUrl || !this.githubToken) return null;

    try {
      // Extract repo path from URL
      const repoPath = githubUrl.match(
        /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/
      )?.[1];
      if (!repoPath) return null;

      const response = await axios.get(
        `${this.GITHUB_API_BASE}/repos/${repoPath}`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
          },
          timeout: 10000,
        }
      );

      const repo = response.data;

      // Get contributors
      const contributorsResponse = await axios.get(
        `${this.GITHUB_API_BASE}/repos/${repoPath}/contributors`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
          },
          timeout: 10000,
        }
      );

      return {
        repositories: 1, // This is just one repo
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        contributors: contributorsResponse.data.length,
        lastCommit: repo.updated_at,
      };
    } catch (error) {
      console.log(
        "GitHub analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  }

  /**
   * Extract social media links from HTML
   */
  private extractSocialLinksFromHTML(html: string): string[] {
    const links: string[] = [];
    const socialPatterns = [
      /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/g,
      /(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]+/g,
      /discord\.gg\/[a-zA-Z0-9]+/g,
      /github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g,
    ];

    socialPatterns.forEach((pattern) => {
      const matches = html.match(pattern);
      if (matches) {
        links.push(...matches);
      }
    });

    return links;
  }

  /**
   * Evaluate Twitter legitimacy signals
   */
  private evaluateTwitterLegitimacy(
    analysis: SocialMediaAnalysis,
    metrics: any
  ): void {
    if (metrics.followers > 1000) {
      analysis.legitimacySignals.push(
        `Strong Twitter presence: ${metrics.followers.toLocaleString()} followers`
      );
    }
    if (metrics.verified) {
      analysis.legitimacySignals.push("Verified Twitter account");
    }
    if (metrics.accountAge > 30) {
      analysis.legitimacySignals.push(
        `Established Twitter account: ${metrics.accountAge} days old`
      );
    }
    if (metrics.followers < 100) {
      analysis.redFlags.push("Very low Twitter following");
    }
    if (metrics.accountAge < 7) {
      analysis.redFlags.push("Very new Twitter account");
    }
  }

  /**
   * Evaluate Telegram legitimacy signals
   */
  private evaluateTelegramLegitimacy(
    analysis: SocialMediaAnalysis,
    metrics: any
  ): void {
    if (metrics.members > 1000) {
      analysis.legitimacySignals.push(
        `Active Telegram community: ${metrics.members.toLocaleString()} members`
      );
    }
    if (metrics.groupAge > 30) {
      analysis.legitimacySignals.push(
        `Established Telegram group: ${metrics.groupAge} days old`
      );
    }
    if (metrics.members < 100) {
      analysis.redFlags.push("Very small Telegram group");
    }
    if (metrics.groupAge < 7) {
      analysis.redFlags.push("Very new Telegram group");
    }
  }

  /**
   * Evaluate Discord legitimacy signals
   */
  private evaluateDiscordLegitimacy(
    analysis: SocialMediaAnalysis,
    metrics: any
  ): void {
    if (metrics.members > 500) {
      analysis.legitimacySignals.push(
        `Active Discord server: ${metrics.members.toLocaleString()} members`
      );
    }
    if (metrics.online > 50) {
      analysis.legitimacySignals.push(
        `High Discord activity: ${metrics.online} online`
      );
    }
    if (metrics.serverAge > 30) {
      analysis.legitimacySignals.push(
        `Established Discord server: ${metrics.serverAge} days old`
      );
    }
    if (metrics.members < 50) {
      analysis.redFlags.push("Very small Discord server");
    }
    if (metrics.serverAge < 7) {
      analysis.redFlags.push("Very new Discord server");
    }
  }

  /**
   * Evaluate website legitimacy signals
   */
  private evaluateWebsiteLegitimacy(
    analysis: SocialMediaAnalysis,
    metrics: any
  ): void {
    if (metrics.hasSSL) {
      analysis.legitimacySignals.push("Secure website (HTTPS)");
    }
    if (metrics.hasPrivacyPolicy) {
      analysis.legitimacySignals.push("Has privacy policy");
    }
    if (metrics.hasTermsOfService) {
      analysis.legitimacySignals.push("Has terms of service");
    }
    if (metrics.socialLinks.length > 0) {
      analysis.legitimacySignals.push(
        `Linked to ${metrics.socialLinks.length} social platforms`
      );
    }
    if (!metrics.hasSSL) {
      analysis.redFlags.push("Insecure website (HTTP)");
    }
    if (!metrics.hasPrivacyPolicy && !metrics.hasTermsOfService) {
      analysis.redFlags.push("No legal documentation");
    }
  }

  /**
   * Evaluate GitHub legitimacy signals
   */
  private evaluateGitHubLegitimacy(
    analysis: SocialMediaAnalysis,
    metrics: any
  ): void {
    if (metrics.stars > 10) {
      analysis.legitimacySignals.push(
        `Popular GitHub repository: ${metrics.stars} stars`
      );
    }
    if (metrics.contributors > 1) {
      analysis.legitimacySignals.push(
        `Multiple contributors: ${metrics.contributors} developers`
      );
    }
    if (metrics.forks > 5) {
      analysis.legitimacySignals.push(
        `Active development: ${metrics.forks} forks`
      );
    }
    if (metrics.stars === 0) {
      analysis.redFlags.push("No GitHub stars");
    }
    if (metrics.contributors === 1) {
      analysis.redFlags.push("Single developer project");
    }
  }

  /**
   * Calculate overall social media legitimacy score
   */
  private calculateOverallScore(analysis: SocialMediaAnalysis): number {
    let score = 0;
    const maxScore = 100;

    // Base score for having social presence
    const platforms = [
      analysis.hasTwitter,
      analysis.hasTelegram,
      analysis.hasDiscord,
      analysis.hasWebsite,
      analysis.hasGitHub,
    ];
    const activePlatforms = platforms.filter(Boolean).length;
    score += Math.min(activePlatforms * 10, 30); // Max 30 points for platform presence

    // Legitimacy signals (positive)
    score += Math.min(analysis.legitimacySignals.length * 5, 40); // Max 40 points for positive signals

    // Red flags (negative)
    score -= Math.min(analysis.redFlags.length * 8, 30); // Max 30 point penalty for red flags

    // Bonus for verified accounts
    if (analysis.twitterMetrics?.verified) {
      score += 15;
    }

    // Bonus for high engagement
    if (
      analysis.twitterMetrics?.followers &&
      analysis.twitterMetrics.followers > 10000
    )
      score += 10;
    if (
      analysis.telegramMetrics?.members &&
      analysis.telegramMetrics.members > 10000
    )
      score += 10;
    if (
      analysis.discordMetrics?.members &&
      analysis.discordMetrics.members > 5000
    )
      score += 10;

    return Math.max(0, Math.min(score, maxScore));
  }
}
