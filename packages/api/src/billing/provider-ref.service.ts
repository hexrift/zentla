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

  async getStripeCustomerId(
    workspaceId: string,
    customerId: string
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'customer', customerId, 'stripe');
    return ref?.externalId ?? null;
  }

  async getStripePriceId(
    workspaceId: string,
    offerVersionId: string
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'price', offerVersionId, 'stripe');
    return ref?.externalId ?? null;
  }

  async getStripeProductId(
    workspaceId: string,
    offerId: string
  ): Promise<string | null> {
    const ref = await this.findByEntity(workspaceId, 'product', offerId, 'stripe');
    return ref?.externalId ?? null;
  }
}
