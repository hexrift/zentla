import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ProviderRef, EntityType, Provider, Prisma } from '@prisma/client';

export interface CreateProviderRefDto {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  provider: Provider;
  externalId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ProviderRefService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEntity(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    provider: Provider
  ): Promise<ProviderRef | null> {
    return this.prisma.providerRef.findFirst({
      where: {
        workspaceId,
        entityType,
        entityId,
        provider,
      },
    });
  }

  async findByExternalId(
    workspaceId: string,
    provider: Provider,
    entityType: EntityType,
    externalId: string
  ): Promise<ProviderRef | null> {
    return this.prisma.providerRef.findFirst({
      where: {
        workspaceId,
        provider,
        entityType,
        externalId,
      },
    });
  }

  async create(dto: CreateProviderRefDto): Promise<ProviderRef> {
    return this.prisma.providerRef.create({
      data: {
        workspaceId: dto.workspaceId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        provider: dto.provider,
        externalId: dto.externalId,
        metadata: dto.metadata as Prisma.InputJsonValue ?? undefined,
      },
    });
  }

  async upsert(dto: CreateProviderRefDto): Promise<ProviderRef> {
    return this.prisma.providerRef.upsert({
      where: {
        workspaceId_entityType_entityId_provider: {
          workspaceId: dto.workspaceId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          provider: dto.provider,
        },
      },
      update: {
        externalId: dto.externalId,
        metadata: dto.metadata as Prisma.InputJsonValue ?? undefined,
      },
      create: {
        workspaceId: dto.workspaceId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        provider: dto.provider,
        externalId: dto.externalId,
        metadata: dto.metadata as Prisma.InputJsonValue ?? undefined,
      },
    });
  }

  async delete(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    provider: Provider
  ): Promise<void> {
    await this.prisma.providerRef.deleteMany({
      where: {
        workspaceId,
        entityType,
        entityId,
        provider,
      },
    });
  }

  // ============================================================================
  // Provider-Agnostic Methods (Preferred)
  // ============================================================================

  /**
   * Get the external customer ID for a given provider.
   * @param workspaceId - Workspace ID
   * @param customerId - Relay customer ID
   * @param provider - Billing provider (defaults to 'stripe')
   * @returns External customer ID or null if not found
   */
  async getProviderCustomerId(
    workspaceId: string,
    customerId: string,
    provider: Provider = 'stripe'
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'customer', customerId, provider);
    return ref?.externalId ?? null;
  }

  /**
   * Get the external price ID for a given provider.
   * @param workspaceId - Workspace ID
   * @param offerVersionId - Relay offer version ID
   * @param provider - Billing provider (defaults to 'stripe')
   * @returns External price ID or null if not found
   */
  async getProviderPriceId(
    workspaceId: string,
    offerVersionId: string,
    provider: Provider = 'stripe'
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'price', offerVersionId, provider);
    return ref?.externalId ?? null;
  }

  /**
   * Get the external product ID for a given provider.
   * @param workspaceId - Workspace ID
   * @param offerId - Relay offer ID
   * @param provider - Billing provider (defaults to 'stripe')
   * @returns External product ID or null if not found
   */
  async getProviderProductId(
    workspaceId: string,
    offerId: string,
    provider: Provider = 'stripe'
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'product', offerId, provider);
    return ref?.externalId ?? null;
  }

  /**
   * Get the external subscription ID for a given provider.
   * @param workspaceId - Workspace ID
   * @param subscriptionId - Relay subscription ID
   * @param provider - Billing provider (defaults to 'stripe')
   * @returns External subscription ID or null if not found
   */
  async getProviderSubscriptionId(
    workspaceId: string,
    subscriptionId: string,
    provider: Provider = 'stripe'
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'subscription', subscriptionId, provider);
    return ref?.externalId ?? null;
  }

  // ============================================================================
  // Deprecated Stripe-Specific Methods
  // Keep for backward compatibility, will be removed in future version.
  // ============================================================================

  /**
   * @deprecated Use getProviderCustomerId(workspaceId, customerId, 'stripe') instead.
   */
  async getStripeCustomerId(
    workspaceId: string,
    customerId: string
  ): Promise<string | null> {
    return this.getProviderCustomerId(workspaceId, customerId, 'stripe');
  }

  /**
   * @deprecated Use getProviderPriceId(workspaceId, offerVersionId, 'stripe') instead.
   */
  async getStripePriceId(
    workspaceId: string,
    offerVersionId: string
  ): Promise<string | null> {
    return this.getProviderPriceId(workspaceId, offerVersionId, 'stripe');
  }

  /**
   * @deprecated Use getProviderProductId(workspaceId, offerId, 'stripe') instead.
   */
  async getStripeProductId(
    workspaceId: string,
    offerId: string
  ): Promise<string | null> {
    return this.getProviderProductId(workspaceId, offerId, 'stripe');
  }
}
