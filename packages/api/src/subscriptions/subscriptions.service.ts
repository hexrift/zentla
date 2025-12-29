import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Subscription, SubscriptionStatus, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@relay/database';

export interface SubscriptionWithRelations extends Subscription {
  customer: {
    id: string;
    email: string;
    name: string | null;
  };
  offer: {
    id: string;
    name: string;
  };
  offerVersion: {
    id: string;
    version: number;
    config: unknown;
  };
}

export interface SubscriptionQueryParams {
  limit: number;
  cursor?: string;
  customerId?: string;
  offerId?: string;
  status?: SubscriptionStatus;
  statuses?: SubscriptionStatus[];
}

export interface CancelSubscriptionDto {
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface ChangeSubscriptionDto {
  newOfferId: string;
  newOfferVersionId?: string;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    workspaceId: string,
    id: string
  ): Promise<SubscriptionWithRelations | null> {
    return this.prisma.subscription.findFirst({
      where: { id, workspaceId },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
        offerVersion: {
          select: { id: true, version: true, config: true },
        },
      },
    });
  }

  async findByCustomerId(workspaceId: string, customerId: string): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { workspaceId, customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMany(
    workspaceId: string,
    params: SubscriptionQueryParams
  ): Promise<PaginatedResult<Subscription>> {
    const { limit, cursor, customerId, offerId, status, statuses } = params;

    const where: Prisma.SubscriptionWhereInput = {
      workspaceId,
      ...(customerId && { customerId }),
      ...(offerId && { offerId }),
      ...(status && { status }),
      ...(statuses && { status: { in: statuses } }),
    };

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
      },
    });

    const hasMore = subscriptions.length > limit;
    const data = hasMore ? subscriptions.slice(0, -1) : subscriptions;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async cancel(
    workspaceId: string,
    id: string,
    dto: CancelSubscriptionDto
  ): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    const now = new Date();

    if (dto.cancelAtPeriodEnd) {
      return this.prisma.subscription.update({
        where: { id },
        data: {
          cancelAt: subscription.currentPeriodEnd,
          metadata: {
            ...(subscription.metadata as Record<string, unknown>),
            cancelReason: dto.reason,
          },
        },
      });
    }

    return this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'canceled',
        canceledAt: now,
        endedAt: now,
        metadata: {
          ...(subscription.metadata as Record<string, unknown>),
          cancelReason: dto.reason,
        },
      },
    });
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: SubscriptionStatus
  ): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return this.prisma.subscription.update({
      where: { id },
      data: { status },
    });
  }

  async getActiveSubscriptionsForCustomer(
    workspaceId: string,
    customerId: string
  ): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: {
        workspaceId,
        customerId,
        status: { in: ['active', 'trialing'] },
      },
      include: {
        offer: true,
        offerVersion: true,
      },
    });
  }
}
