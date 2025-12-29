import type { Workspace } from '@prisma/client';
import type { PaginationParams, PaginatedResult } from '../types';

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  findMany(params: PaginationParams): Promise<PaginatedResult<Workspace>>;
  create(data: WorkspaceCreateData): Promise<Workspace>;
  update(id: string, data: WorkspaceUpdateData): Promise<Workspace>;
  delete(id: string): Promise<void>;
}

export interface WorkspaceCreateData {
  name: string;
  slug: string;
  defaultProvider?: 'stripe' | 'zuora';
  settings?: WorkspaceSettings;
}

export interface WorkspaceUpdateData {
  name?: string;
  defaultProvider?: 'stripe' | 'zuora';
  settings?: Partial<WorkspaceSettings>;
}

export interface WorkspaceSettings {
  webhookRetryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  defaultCurrency?: string;
  stripeAccountId?: string;
  zuoraAccountId?: string;
}
