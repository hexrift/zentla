import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

export interface UsageEventInput {
  customerId: string;
  subscriptionId?: string;
  metricKey: string;
  quantity: number;
  timestamp?: Date;
  idempotencyKey?: string;
  properties?: Record<string, unknown>;
}

export interface UsageSummary {
  metricKey: string;
  totalQuantity: number;
  eventCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface UsageQuery {
  customerId?: string;
  subscriptionId?: string;
  metricKey?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest a single usage event
   */
  async ingestEvent(
    workspaceId: string,
    input: UsageEventInput,
  ): Promise<{ id: string; deduplicated: boolean }> {
    // Check for duplicate via idempotency key
    if (input.idempotencyKey) {
      const existing = await this.prisma.usageEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true },
      });

      if (existing) {
        return { id: existing.id, deduplicated: true };
      }
    }

    const event = await this.prisma.usageEvent.create({
      data: {
        workspaceId,
        customerId: input.customerId,
        subscriptionId: input.subscriptionId,
        metricKey: input.metricKey,
        quantity: new Decimal(input.quantity),
        timestamp: input.timestamp ?? new Date(),
        idempotencyKey: input.idempotencyKey,
        properties: (input.properties ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Update aggregate (async, don't wait)
    this.updateAggregate(
      workspaceId,
      input.customerId,
      input.subscriptionId,
      input.metricKey,
      input.quantity,
    ).catch((err) => {
      console.error("Failed to update usage aggregate:", err);
    });

    return { id: event.id, deduplicated: false };
  }

  /**
   * Ingest multiple usage events in batch
   */
  async ingestBatch(
    workspaceId: string,
    events: UsageEventInput[],
  ): Promise<{ ingested: number; deduplicated: number }> {
    if (events.length > 1000) {
      throw new BadRequestException("Batch size cannot exceed 1000 events");
    }

    let ingested = 0;
    let deduplicated = 0;

    // Process in chunks for better performance
    const chunkSize = 100;
    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map((event) => this.ingestEvent(workspaceId, event)),
      );

      for (const result of results) {
        if (result.deduplicated) {
          deduplicated++;
        } else {
          ingested++;
        }
      }
    }

    return { ingested, deduplicated };
  }

  /**
   * Get usage summary for a customer/subscription
   */
  async getUsageSummary(
    workspaceId: string,
    customerId: string,
    metricKey: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<UsageSummary> {
    const aggregate = await this.prisma.usageAggregate.findUnique({
      where: {
        workspaceId_customerId_metricKey_periodStart: {
          workspaceId,
          customerId,
          metricKey,
          periodStart,
        },
      },
    });

    if (aggregate) {
      return {
        metricKey,
        totalQuantity: aggregate.totalQuantity.toNumber(),
        eventCount: aggregate.eventCount,
        periodStart,
        periodEnd,
      };
    }

    // Fall back to computing from events
    const result = await this.prisma.usageEvent.aggregate({
      where: {
        workspaceId,
        customerId,
        metricKey,
        timestamp: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      _sum: { quantity: true },
      _count: true,
    });

    return {
      metricKey,
      totalQuantity: result._sum.quantity?.toNumber() ?? 0,
      eventCount: result._count,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Get current period usage for a subscription
   */
  async getCurrentPeriodUsage(
    workspaceId: string,
    subscriptionId: string,
    metricKey: string,
  ): Promise<UsageSummary | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, workspaceId },
      select: {
        customerId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });

    if (!subscription) {
      return null;
    }

    return this.getUsageSummary(
      workspaceId,
      subscription.customerId,
      metricKey,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
  }

  /**
   * List usage events with pagination
   */
  async listEvents(workspaceId: string, query: UsageQuery) {
    const limit = query.limit ?? 50;

    const events = await this.prisma.usageEvent.findMany({
      where: {
        workspaceId,
        ...(query.customerId && { customerId: query.customerId }),
        ...(query.subscriptionId && { subscriptionId: query.subscriptionId }),
        ...(query.metricKey && { metricKey: query.metricKey }),
        ...(query.startDate &&
          query.endDate && {
            timestamp: {
              gte: query.startDate,
              lt: query.endDate,
            },
          }),
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, -1) : events;

    return {
      data: data.map((e) => ({
        id: e.id,
        customerId: e.customerId,
        subscriptionId: e.subscriptionId,
        metricKey: e.metricKey,
        quantity: e.quantity.toNumber(),
        timestamp: e.timestamp,
        properties: e.properties,
        createdAt: e.createdAt,
      })),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
    };
  }

  /**
   * Define a new usage metric
   */
  async createMetric(
    workspaceId: string,
    data: {
      key: string;
      name: string;
      description?: string;
      unit?: string;
      aggregation?: "sum" | "max" | "count" | "last";
    },
  ) {
    return this.prisma.usageMetric.create({
      data: {
        workspaceId,
        key: data.key,
        name: data.name,
        description: data.description,
        unit: data.unit,
        aggregation: data.aggregation ?? "sum",
      },
    });
  }

  /**
   * List defined metrics
   */
  async listMetrics(workspaceId: string) {
    return this.prisma.usageMetric.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update usage aggregate (called after event ingestion)
   */
  private async updateAggregate(
    workspaceId: string,
    customerId: string,
    subscriptionId: string | undefined,
    metricKey: string,
    quantity: number,
  ): Promise<void> {
    // Get the current billing period from subscription
    let periodStart = new Date();
    let periodEnd = new Date();

    if (subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { currentPeriodStart: true, currentPeriodEnd: true },
      });

      if (subscription) {
        periodStart = subscription.currentPeriodStart;
        periodEnd = subscription.currentPeriodEnd;
      }
    } else {
      // Default to current month if no subscription
      periodStart = new Date(
        Date.UTC(
          periodStart.getUTCFullYear(),
          periodStart.getUTCMonth(),
          1,
          0,
          0,
          0,
          0,
        ),
      );
      periodEnd = new Date(
        Date.UTC(
          periodStart.getUTCFullYear(),
          periodStart.getUTCMonth() + 1,
          1,
          0,
          0,
          0,
          0,
        ),
      );
    }

    await this.prisma.usageAggregate.upsert({
      where: {
        workspaceId_customerId_metricKey_periodStart: {
          workspaceId,
          customerId,
          metricKey,
          periodStart,
        },
      },
      create: {
        workspaceId,
        customerId,
        subscriptionId,
        metricKey,
        periodStart,
        periodEnd,
        totalQuantity: new Decimal(quantity),
        eventCount: 1,
      },
      update: {
        totalQuantity: { increment: quantity },
        eventCount: { increment: 1 },
        lastUpdatedAt: new Date(),
      },
    });
  }
}
