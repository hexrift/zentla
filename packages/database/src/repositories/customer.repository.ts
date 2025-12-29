import type { Customer } from '@prisma/client';
import type { PaginationParams, PaginatedResult } from '../types';

export interface CustomerRepository {
  findById(workspaceId: string, id: string): Promise<Customer | null>;
  findByEmail(workspaceId: string, email: string): Promise<Customer | null>;
  findByExternalId(workspaceId: string, externalId: string): Promise<Customer | null>;
  findMany(workspaceId: string, params: CustomerQueryParams): Promise<PaginatedResult<Customer>>;
  create(workspaceId: string, data: CustomerCreateData): Promise<Customer>;
  update(workspaceId: string, id: string, data: CustomerUpdateData): Promise<Customer>;
  delete(workspaceId: string, id: string): Promise<void>;
}

export interface CustomerQueryParams extends PaginationParams {
  email?: string;
  externalId?: string;
}

export interface CustomerCreateData {
  email: string;
  name?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerUpdateData {
  email?: string;
  name?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}
