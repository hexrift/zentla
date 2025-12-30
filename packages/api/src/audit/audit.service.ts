import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ActorType, Prisma } from '@prisma/client';

interface ListAuditLogsParams {
  limit: number;
  cursor?: string;
  actorType?: ActorType;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateAuditLogDto {
  workspaceId: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createAuditLog(dto: CreateAuditLogDto): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        workspaceId: dto.workspaceId,
        actorType: dto.actorType,
        actorId: dto.actorId,
        action: dto.action,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        changes: dto.changes as Prisma.InputJsonValue ?? undefined,
        metadata: dto.metadata as Prisma.InputJsonValue ?? {},
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });
  }

  async listAuditLogs(
    workspaceId: string,
    params: ListAuditLogsParams
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const {
      limit,
      cursor,
      actorType,
      actorId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
    } = params;

    const where: Prisma.AuditLogWhereInput = { workspaceId };

    if (actorType) where.actorType = actorType;
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (cursor) {
      where.id = { lt: cursor };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data: data.map((log) => ({
        id: log.id,
        actorType: log.actorType,
        actorId: log.actorId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        changes: log.changes,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor,
    };
  }
}
