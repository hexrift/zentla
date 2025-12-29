import type { Subscription, SubscriptionStatus, Entitlement } from '@prisma/client';
import type { PaginationParams, PaginatedResult } from '../types';

export interface SubscriptionRepository {
  findById(workspaceId: string, id: string): Promise<SubscriptionWithRelations | null>;
  findByCustomerId(workspaceId: string, customerId: string): Promise<Subscription[]>;
  findMany(workspaceId: string, params: SubscriptionQueryParams): Promise<PaginatedResult<Subscription>>;
  create(workspaceId: string, data: SubscriptionCreateData): Promise<Subscription>;
  update(workspaceId: string, id: string, data: SubscriptionUpdateData): Promise<Subscription>;
  updateStatus(workspaceId: string, id: string, status: SubscriptionStatus): Promise<Subscription>;
  cancel(workspaceId: string, id: string, params: CancelParams): Promise<Subscription>;
}

export interface SubscriptionWithRelations extends Subscription {
  entitlements: Entitlement[];
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

export interface SubscriptionQueryParams extends PaginationParams {
  customerId?: string;
  offerId?: string;
  status?: SubscriptionStatus;
  statuses?: SubscriptionStatus[];
}

export interface SubscriptionCreateData {
  customerId: string;
  offerId: string;
  offerVersionId: string;
  status?: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionUpdateData {
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  endedAt?: Date;
  trialEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface CancelParams {
  cancelAtPeriodEnd: boolean;
  reason?: string;
}
