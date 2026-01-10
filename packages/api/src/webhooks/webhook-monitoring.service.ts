import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

/**
 * Overall webhook delivery statistics.
 */
export interface WebhookStats {
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  totalDeadLetter: number;
  deliveryRate: number;
  averageAttempts: number;
}

/**
 * Endpoint health information.
 */
export interface EndpointHealth {
  id: string;
  url: string;
  status: string;
  successCount: number;
  failureCount: number;
  deliveryRate: number;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: number | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  pendingEvents: number;
  health: "healthy" | "degraded" | "unhealthy";
}

/**
 * Recent webhook event with delivery status.
 */
export interface WebhookEventSummary {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  status: string;
  attempts: number;
  lastAttemptAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  response?: {
    statusCode?: number;
    error?: string;
  };
}

/**
 * Dead letter event summary.
 */
export interface DeadLetterEventSummary {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  failureReason: string;
  attempts: number;
  lastAttemptAt: Date;
  createdAt: Date;
}

@Injectable()
export class WebhookMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get overall webhook delivery statistics.
   */
  async getStats(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<WebhookStats> {
    const now = new Date();
    const periodStart = startDate ?? new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const periodEnd = endDate ?? now;

    const statusCounts = await this.prisma.webhookEvent.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _count: true,
    });

    let totalDelivered = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalDeadLetter = 0;

    for (const s of statusCounts) {
      switch (s.status) {
        case "delivered":
          totalDelivered = s._count;
          break;
        case "failed":
          totalFailed = s._count;
          break;
        case "pending":
          totalPending = s._count;
          break;
        case "dead_letter":
          totalDeadLetter = s._count;
          break;
      }
    }

    const total = totalDelivered + totalFailed + totalDeadLetter;
    const deliveryRate = total > 0 ? Math.round((totalDelivered / total) * 100) : 100;

    // Calculate average attempts for delivered events
    const avgAttempts = await this.prisma.webhookEvent.aggregate({
      where: {
        workspaceId,
        status: "delivered",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _avg: { attempts: true },
    });

    return {
      totalDelivered,
      totalFailed,
      totalPending,
      totalDeadLetter,
      deliveryRate,
      averageAttempts: Math.round((avgAttempts._avg.attempts ?? 1) * 10) / 10,
    };
  }

  /**
   * Get health status for all endpoints.
   */
  async getEndpointHealth(workspaceId: string): Promise<EndpointHealth[]> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    const healthData: EndpointHealth[] = [];

    for (const endpoint of endpoints) {
      // Count pending events for this endpoint
      const pendingEvents = await this.prisma.webhookEvent.count({
        where: {
          endpointId: endpoint.id,
          status: "pending",
        },
      });

      // Calculate delivery rate
      const total = endpoint.successCount + endpoint.failureCount;
      const deliveryRate = total > 0
        ? Math.round((endpoint.successCount / total) * 100)
        : 100;

      // Determine health status
      let health: "healthy" | "degraded" | "unhealthy";
      if (endpoint.status === "disabled") {
        health = "unhealthy";
      } else if (deliveryRate >= 95) {
        health = "healthy";
      } else if (deliveryRate >= 80) {
        health = "degraded";
      } else {
        health = "unhealthy";
      }

      // Also consider recent errors
      if (endpoint.lastErrorAt) {
        const errorAge = Date.now() - endpoint.lastErrorAt.getTime();
        if (errorAge < 60 * 60 * 1000) {
          // Error in last hour
          health = health === "healthy" ? "degraded" : health;
        }
      }

      healthData.push({
        id: endpoint.id,
        url: endpoint.url,
        status: endpoint.status,
        successCount: endpoint.successCount,
        failureCount: endpoint.failureCount,
        deliveryRate,
        lastDeliveryAt: endpoint.lastDeliveryAt,
        lastDeliveryStatus: endpoint.lastDeliveryStatus,
        lastErrorAt: endpoint.lastErrorAt,
        lastError: endpoint.lastError,
        pendingEvents,
        health,
      });
    }

    return healthData;
  }

  /**
   * Get recent webhook events.
   */
  async getRecentEvents(
    workspaceId: string,
    options: {
      endpointId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ data: WebhookEventSummary[]; hasMore: boolean; nextCursor?: string }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const where: Record<string, unknown> = { workspaceId };
    if (options.endpointId) where.endpointId = options.endpointId;
    if (options.status) where.status = options.status;
    if (options.cursor) where.id = { lt: options.cursor };

    const events = await this.prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        endpoint: {
          select: { url: true },
        },
      },
    });

    const hasMore = events.length > limit;
    if (hasMore) events.pop();

    const data: WebhookEventSummary[] = events.map((event) => ({
      id: event.id,
      endpointId: event.endpointId,
      endpointUrl: event.endpoint.url,
      eventType: event.eventType,
      status: event.status,
      attempts: event.attempts,
      lastAttemptAt: event.lastAttemptAt,
      deliveredAt: event.deliveredAt,
      createdAt: event.createdAt,
      response: event.response as { statusCode?: number; error?: string } | undefined,
    }));

    return {
      data,
      hasMore,
      nextCursor: hasMore ? events[events.length - 1]?.id : undefined,
    };
  }

  /**
   * Get dead letter events.
   */
  async getDeadLetterEvents(
    workspaceId: string,
    options: {
      endpointId?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ data: DeadLetterEventSummary[]; hasMore: boolean; nextCursor?: string }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const where: Record<string, unknown> = { workspaceId };
    if (options.endpointId) where.endpointId = options.endpointId;
    if (options.cursor) where.id = { lt: options.cursor };

    const events = await this.prisma.deadLetterEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        endpoint: {
          select: { url: true },
        },
      },
    });

    const hasMore = events.length > limit;
    if (hasMore) events.pop();

    const data: DeadLetterEventSummary[] = events.map((event) => ({
      id: event.id,
      endpointId: event.endpointId,
      endpointUrl: event.endpoint.url,
      eventType: event.eventType,
      failureReason: event.failureReason,
      attempts: event.attempts,
      lastAttemptAt: event.lastAttemptAt,
      createdAt: event.createdAt,
    }));

    return {
      data,
      hasMore,
      nextCursor: hasMore ? events[events.length - 1]?.id : undefined,
    };
  }

  /**
   * Retry a dead letter event.
   */
  async retryDeadLetterEvent(
    workspaceId: string,
    deadLetterId: string,
  ): Promise<{ webhookEventId: string }> {
    const deadLetter = await this.prisma.deadLetterEvent.findFirst({
      where: {
        id: deadLetterId,
        workspaceId,
      },
    });

    if (!deadLetter) {
      throw new Error("Dead letter event not found");
    }

    // Create a new webhook event from the dead letter
    const newEvent = await this.prisma.webhookEvent.create({
      data: {
        workspaceId,
        endpointId: deadLetter.endpointId,
        eventType: deadLetter.eventType,
        payload: deadLetter.payload ?? {},
        status: "pending",
        attempts: 0,
      },
    });

    // Remove from dead letter queue
    await this.prisma.deadLetterEvent.delete({
      where: { id: deadLetterId },
    });

    return { webhookEventId: newEvent.id };
  }

  /**
   * Get event type breakdown.
   */
  async getEventTypeBreakdown(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{ eventType: string; count: number; deliveryRate: number }>> {
    const now = new Date();
    const periodStart = startDate ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    const periodEnd = endDate ?? now;

    const breakdown = await this.prisma.webhookEvent.groupBy({
      by: ["eventType", "status"],
      where: {
        workspaceId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _count: true,
    });

    // Aggregate by event type
    const eventTypes = new Map<string, { total: number; delivered: number }>();

    for (const item of breakdown) {
      const current = eventTypes.get(item.eventType) ?? { total: 0, delivered: 0 };
      current.total += item._count;
      if (item.status === "delivered") {
        current.delivered += item._count;
      }
      eventTypes.set(item.eventType, current);
    }

    return Array.from(eventTypes.entries())
      .map(([eventType, stats]) => ({
        eventType,
        count: stats.total,
        deliveryRate: stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 100,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
