import type { ProviderRef, Provider, EntityType } from '@prisma/client';

export interface ProviderRefRepository {
  findByEntity(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    provider: Provider
  ): Promise<ProviderRef | null>;

  findByExternalId(
    workspaceId: string,
    provider: Provider,
    entityType: EntityType,
    externalId: string
  ): Promise<ProviderRef | null>;

  findAllByEntity(
    workspaceId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<ProviderRef[]>;

  create(data: ProviderRefCreateData): Promise<ProviderRef>;

  upsert(data: ProviderRefCreateData): Promise<ProviderRef>;

  delete(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    provider: Provider
  ): Promise<void>;

  deleteAllByEntity(
    workspaceId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<void>;
}

export interface ProviderRefCreateData {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  provider: Provider;
  externalId: string;
  metadata?: Record<string, unknown>;
}
