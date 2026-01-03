import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

interface ListEventsParams {
  limit: number;
  cursor?: string;
  status?: "pending" | "processed" | "failed";
  eventType?: string;
  aggregateType?: string;
  aggregateId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(
    workspaceId: string,
    params: ListEventsParams,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { limit, cursor, status, eventType, aggregateType, aggregateId } =
      params;

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (aggregateType) where.aggregateType = aggregateType;
    if (aggregateId) where.aggregateId = aggregateId;

    const events = await this.prisma.outboxEvent.findMany({
      where: {
        ...where,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data: data.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        status: e.status,
        payload: e.payload,
        processedAt: e.processedAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor,
    };
  }

  async listDeadLetterEvents(
    workspaceId: string,
    params: { limit: number; cursor?: string },
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { limit, cursor } = params;

    const events = await this.prisma.deadLetterEvent.findMany({
      where: {
        workspaceId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        endpoint: {
          select: { url: true },
        },
      },
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data: data.map((e) => ({
        id: e.id,
        originalEventId: e.originalEventId,
        endpointId: e.endpointId,
        endpointUrl: e.endpoint?.url,
        eventType: e.eventType,
        payload: e.payload,
        failureReason: e.failureReason,
        attempts: e.attempts,
        lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor,
    };
  }
}
