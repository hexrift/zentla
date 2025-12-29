import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { OutboxEvent, Prisma } from '@prisma/client';

export interface CreateOutboxEventDto {
  workspaceId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(dto: CreateOutboxEventDto): Promise<OutboxEvent> {
    return this.prisma.outboxEvent.create({
      data: {
        workspaceId: dto.workspaceId,
        eventType: dto.eventType,
        aggregateType: dto.aggregateType,
        aggregateId: dto.aggregateId,
        payload: dto.payload as Prisma.InputJsonValue,
        status: 'pending',
      },
    });
  }

  async getPendingEvents(limit: number = 100): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'failed' },
    });
  }

  async createDeadLetterEvent(
    workspaceId: string,
    originalEventId: string,
    endpointId: string,
    eventType: string,
    payload: Record<string, unknown>,
    failureReason: string,
    attempts: number
  ): Promise<void> {
    await this.prisma.deadLetterEvent.create({
      data: {
        workspaceId,
        originalEventId,
        endpointId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        failureReason,
        attempts,
        lastAttemptAt: new Date(),
      },
    });
  }

  async getDeadLetterEvents(
    workspaceId: string,
    limit: number = 100
  ): Promise<unknown[]> {
    return this.prisma.deadLetterEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
