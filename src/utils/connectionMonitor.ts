import { Server } from "socket.io";
import winston from "winston";

interface ConnectionInfo {
  socketId: string;
  ip: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptionCount: number;
  userAgent?: string;
}

export class ConnectionMonitor {
  private connections: Map<string, ConnectionInfo>;
  private io: Server;
  private logger: winston.Logger;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly MAX_CONNECTIONS_PER_IP = 5;
  private readonly MAX_SUBSCRIPTIONS_PER_SOCKET = 10;
  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 minutes
  private readonly STATS_INTERVAL = 30 * 1000; // 30 seconds

  constructor(io: Server, logger: winston.Logger) {
    this.connections = new Map();
    this.io = io;
    this.logger = logger;
    this.startMonitoring();
  }

  /**
   * Start monitoring connections
   */
  private startMonitoring(): void {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, this.CLEANUP_INTERVAL);

    // Start stats logging
    this.statsInterval = setInterval(() => {
      this.logConnectionStats();
    }, this.STATS_INTERVAL);

    this.logger.info("Connection monitor started", {
      maxConnectionsPerIP: this.MAX_CONNECTIONS_PER_IP,
      maxSubscriptionsPerSocket: this.MAX_SUBSCRIPTIONS_PER_SOCKET,
      connectionTimeout: this.CONNECTION_TIMEOUT,
      cleanupInterval: this.CLEANUP_INTERVAL,
    });
  }

  /**
   * Add a new connection
   */
  addConnection(socketId: string, ip: string, userAgent?: string): boolean {
    // Check if IP has too many connections
    const existingConnections = this.getConnectionsByIP(ip).length;
    if (existingConnections >= this.MAX_CONNECTIONS_PER_IP) {
      this.logger.warn("Connection limit exceeded for IP", {
        socketId,
        ip,
        existingConnections,
        maxConnections: this.MAX_CONNECTIONS_PER_IP,
      });
      return false;
    }

    const connection: ConnectionInfo = {
      socketId,
      ip,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptionCount: 0,
      userAgent,
    };

    this.connections.set(socketId, connection);

    this.logger.info("Connection added", {
      socketId,
      ip,
      totalConnections: this.connections.size,
      connectionsFromIP: existingConnections + 1,
    });

    return true;
  }

  /**
   * Remove a connection
   */
  removeConnection(socketId: string, reason?: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      this.connections.delete(socketId);
      this.logger.info("Connection removed", {
        socketId,
        ip: connection.ip,
        reason,
        totalConnections: this.connections.size,
      });
    }
  }

  /**
   * Update connection activity
   */
  updateActivity(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  /**
   * Add subscription to connection
   */
  addSubscription(socketId: string, tokenAddress: string): boolean {
    const connection = this.connections.get(socketId);
    if (!connection) {
      return false;
    }

    if (connection.subscriptionCount >= this.MAX_SUBSCRIPTIONS_PER_SOCKET) {
      this.logger.warn("Subscription limit exceeded", {
        socketId,
        ip: connection.ip,
        subscriptionCount: connection.subscriptionCount,
        maxSubscriptions: this.MAX_SUBSCRIPTIONS_PER_SOCKET,
      });
      return false;
    }

    connection.subscriptionCount++;
    connection.lastActivity = new Date();

    this.logger.info("Subscription added", {
      socketId,
      tokenAddress,
      subscriptionCount: connection.subscriptionCount,
    });

    return true;
  }

  /**
   * Remove subscription from connection
   */
  removeSubscription(socketId: string, tokenAddress: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.subscriptionCount = Math.max(
        0,
        connection.subscriptionCount - 1
      );
      connection.lastActivity = new Date();

      this.logger.info("Subscription removed", {
        socketId,
        tokenAddress,
        subscriptionCount: connection.subscriptionCount,
      });
    }
  }

  /**
   * Get connections by IP
   */
  getConnectionsByIP(ip: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.ip === ip
    );
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connectionsByIP: Record<string, number>;
    recentConnections: number;
    averageSubscriptions: number;
    topIPs: Array<{ ip: string; connections: number }>;
  } {
    const stats = {
      totalConnections: this.connections.size,
      connectionsByIP: {} as Record<string, number>,
      recentConnections: 0,
      averageSubscriptions: 0,
      topIPs: [] as Array<{ ip: string; connections: number }>,
    };

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let totalSubscriptions = 0;

    this.connections.forEach((conn) => {
      // Count by IP
      stats.connectionsByIP[conn.ip] =
        (stats.connectionsByIP[conn.ip] || 0) + 1;

      // Count recent connections
      if (conn.connectedAt > fiveMinutesAgo) {
        stats.recentConnections++;
      }

      // Sum subscriptions
      totalSubscriptions += conn.subscriptionCount;
    });

    // Calculate average subscriptions
    stats.averageSubscriptions =
      this.connections.size > 0
        ? totalSubscriptions / this.connections.size
        : 0;

    // Get top IPs
    stats.topIPs = Object.entries(stats.connectionsByIP)
      .map(([ip, connections]) => ({ ip, connections }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);

    return stats;
  }

  /**
   * Cleanup inactive connections
   */
  private cleanupInactiveConnections(): void {
    const now = new Date();
    let cleanedCount = 0;

    this.connections.forEach((connection, socketId) => {
      if (
        now.getTime() - connection.lastActivity.getTime() >
        this.CONNECTION_TIMEOUT
      ) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          cleanedCount++;
        }
        this.connections.delete(socketId);
      }
    });

    if (cleanedCount > 0) {
      this.logger.info("Cleaned up inactive connections", {
        cleanedCount,
        remainingConnections: this.connections.size,
      });
    }
  }

  /**
   * Log connection statistics
   */
  private logConnectionStats(): void {
    const stats = this.getStats();

    if (stats.totalConnections > 0) {
      this.logger.info("Connection statistics", {
        totalConnections: stats.totalConnections,
        recentConnections: stats.recentConnections,
        averageSubscriptions: stats.averageSubscriptions.toFixed(2),
        topIPs: stats.topIPs.slice(0, 3), // Log top 3 IPs
      });
    }

    // Alert if too many connections
    if (stats.totalConnections > 100) {
      this.logger.warn("High connection count detected", {
        totalConnections: stats.totalConnections,
        topIPs: stats.topIPs.slice(0, 5),
      });
    }
  }

  /**
   * Force disconnect all connections from an IP
   */
  forceDisconnectIP(ip: string, reason: string): number {
    let disconnectedCount = 0;
    const connectionsToRemove: string[] = [];

    this.connections.forEach((connection, socketId) => {
      if (connection.ip === ip) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          disconnectedCount++;
        }
        connectionsToRemove.push(socketId);
      }
    });

    // Remove from tracking
    connectionsToRemove.forEach((socketId) => {
      this.connections.delete(socketId);
    });

    if (disconnectedCount > 0) {
      this.logger.warn("Force disconnected IP", {
        ip,
        reason,
        disconnectedCount,
        remainingConnections: this.connections.size,
      });
    }

    return disconnectedCount;
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.logger.info("Connection monitor stopped");
  }
}
