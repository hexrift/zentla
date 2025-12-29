import type { Prisma } from '@prisma/client';

// Workspace types
export type WorkspaceCreateInput = Prisma.WorkspaceCreateInput;
export type WorkspaceUpdateInput = Prisma.WorkspaceUpdateInput;
export type WorkspaceWhereInput = Prisma.WorkspaceWhereInput;
export type WorkspaceWhereUniqueInput = Prisma.WorkspaceWhereUniqueInput;
export type WorkspaceOrderByInput = Prisma.WorkspaceOrderByWithRelationInput;

// Customer types
export type CustomerCreateInput = Prisma.CustomerCreateInput;
export type CustomerUpdateInput = Prisma.CustomerUpdateInput;
export type CustomerWhereInput = Prisma.CustomerWhereInput;
export type CustomerWhereUniqueInput = Prisma.CustomerWhereUniqueInput;
export type CustomerOrderByInput = Prisma.CustomerOrderByWithRelationInput;

// Offer types
export type OfferCreateInput = Prisma.OfferCreateInput;
export type OfferUpdateInput = Prisma.OfferUpdateInput;
export type OfferWhereInput = Prisma.OfferWhereInput;
export type OfferWhereUniqueInput = Prisma.OfferWhereUniqueInput;
export type OfferOrderByInput = Prisma.OfferOrderByWithRelationInput;

// OfferVersion types
export type OfferVersionCreateInput = Prisma.OfferVersionCreateInput;
export type OfferVersionUpdateInput = Prisma.OfferVersionUpdateInput;
export type OfferVersionWhereInput = Prisma.OfferVersionWhereInput;
export type OfferVersionWhereUniqueInput = Prisma.OfferVersionWhereUniqueInput;

// Subscription types
export type SubscriptionCreateInput = Prisma.SubscriptionCreateInput;
export type SubscriptionUpdateInput = Prisma.SubscriptionUpdateInput;
export type SubscriptionWhereInput = Prisma.SubscriptionWhereInput;
export type SubscriptionWhereUniqueInput = Prisma.SubscriptionWhereUniqueInput;
export type SubscriptionOrderByInput = Prisma.SubscriptionOrderByWithRelationInput;

// Entitlement types
export type EntitlementCreateInput = Prisma.EntitlementCreateInput;
export type EntitlementUpdateInput = Prisma.EntitlementUpdateInput;
export type EntitlementWhereInput = Prisma.EntitlementWhereInput;
export type EntitlementWhereUniqueInput = Prisma.EntitlementWhereUniqueInput;

// Checkout types
export type CheckoutCreateInput = Prisma.CheckoutCreateInput;
export type CheckoutUpdateInput = Prisma.CheckoutUpdateInput;
export type CheckoutWhereInput = Prisma.CheckoutWhereInput;
export type CheckoutWhereUniqueInput = Prisma.CheckoutWhereUniqueInput;

// WebhookEndpoint types
export type WebhookEndpointCreateInput = Prisma.WebhookEndpointCreateInput;
export type WebhookEndpointUpdateInput = Prisma.WebhookEndpointUpdateInput;
export type WebhookEndpointWhereInput = Prisma.WebhookEndpointWhereInput;
export type WebhookEndpointWhereUniqueInput = Prisma.WebhookEndpointWhereUniqueInput;

// WebhookEvent types
export type WebhookEventCreateInput = Prisma.WebhookEventCreateInput;
export type WebhookEventUpdateInput = Prisma.WebhookEventUpdateInput;
export type WebhookEventWhereInput = Prisma.WebhookEventWhereInput;

// ApiKey types
export type ApiKeyCreateInput = Prisma.ApiKeyCreateInput;
export type ApiKeyUpdateInput = Prisma.ApiKeyUpdateInput;
export type ApiKeyWhereInput = Prisma.ApiKeyWhereInput;
export type ApiKeyWhereUniqueInput = Prisma.ApiKeyWhereUniqueInput;

// AuditLog types
export type AuditLogCreateInput = Prisma.AuditLogCreateInput;
export type AuditLogWhereInput = Prisma.AuditLogWhereInput;

// ProviderRef types
export type ProviderRefCreateInput = Prisma.ProviderRefCreateInput;
export type ProviderRefWhereInput = Prisma.ProviderRefWhereInput;
export type ProviderRefWhereUniqueInput = Prisma.ProviderRefWhereUniqueInput;

// OutboxEvent types
export type OutboxEventCreateInput = Prisma.OutboxEventCreateInput;
export type OutboxEventUpdateInput = Prisma.OutboxEventUpdateInput;
export type OutboxEventWhereInput = Prisma.OutboxEventWhereInput;

// DeadLetterEvent types
export type DeadLetterEventCreateInput = Prisma.DeadLetterEventCreateInput;
export type DeadLetterEventWhereInput = Prisma.DeadLetterEventWhereInput;

// IdempotencyKey types
export type IdempotencyKeyCreateInput = Prisma.IdempotencyKeyCreateInput;
export type IdempotencyKeyWhereInput = Prisma.IdempotencyKeyWhereInput;
export type IdempotencyKeyWhereUniqueInput = Prisma.IdempotencyKeyWhereUniqueInput;

// Pagination types
export interface PaginationParams {
  limit: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

// Transaction types
export type TransactionClient = Prisma.TransactionClient;
