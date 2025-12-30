import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import type { WebhookEndpoint, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@relay/database';

export interface CreateWebhookEndpointDto {
  url: string;
  events: string[];
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWebhookEndpointDto {
  url?: string;
  events?: string[];
  status?: 'active' | 'disabled';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async findEndpointById(
    workspaceId: string,
    id: string
  ): Promise<WebhookEndpoint | null> {
    return this.prisma.webhookEndpoint.findFirst({
      where: { id, workspaceId },
    });
  }

  async findEndpoints(
    workspaceId: string,
    params: { limit: number; cursor?: string }
  ): Promise<PaginatedResult<WebhookEndpoint>> {
    const { limit, cursor } = params;

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { workspaceId },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = endpoints.length > limit;
    const data = hasMore ? endpoints.slice(0, -1) : endpoints;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async createEndpoint(
    workspaceId: string,
    dto: CreateWebhookEndpointDto
  ): Promise<WebhookEndpoint> {
    const secret = this.generateSecret();

    return this.prisma.webhookEndpoint.create({
      data: {
        workspaceId,
        url: dto.url,
        secret,
        events: dto.events,
        status: 'active',
        description: dto.description,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateEndpoint(
    workspaceId: string,
    id: string,
    dto: UpdateWebhookEndpointDto
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.findEndpointById(workspaceId, id);
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(dto.url && { url: dto.url }),
        ...(dto.events && { events: dto.events }),
        ...(dto.status && { status: dto.status }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.metadata && { metadata: dto.metadata as Prisma.InputJsonValue }),
        version: { increment: 1 },
      },
    });
  }

  async deleteEndpoint(workspaceId: string, id: string): Promise<void> {
    const endpoint = await this.findEndpointById(workspaceId, id);
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    await this.prisma.webhookEndpoint.delete({
      where: { id },
    });
  }

  async rotateSecret(workspaceId: string, id: string): Promise<string> {
    const endpoint = await this.findEndpointById(workspaceId, id);
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    const newSecret = this.generateSecret();

    await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { secret: newSecret, version: { increment: 1 } },
    });

    return newSecret;
  }

  signPayload(payload: WebhookPayload, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadString}`;

    const signature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    tolerance: number = 300
  ): boolean {
    const parts = signature.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = parseInt(timestampPart.substring(2), 10);
    const expectedSignature = signaturePart.substring(3);

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const computedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison
    if (computedSignature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  }

  private generateSecret(): string {
    return `whsec_${randomBytes(32).toString('hex')}`;
  }
}
