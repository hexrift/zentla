export { PrismaService } from './prisma.service';
export { createPrismaClient, type PrismaClientOptions } from './prisma.client';

// Re-export Prisma types for strict typing
export {
  PrismaClient,
  Prisma,
  // Enums
  Provider,
  OfferStatus,
  OfferVersionStatus,
  SubscriptionStatus,
  EntitlementValueType,
  CheckoutStatus,
  WebhookEndpointStatus,
  WebhookEventStatus,
  ApiKeyRole,
  ApiKeyEnvironment,
  ActorType,
  EntityType,
  OutboxEventStatus,
} from '@prisma/client';

// Re-export model types
export type {
  Workspace,
  Customer,
  Offer,
  OfferVersion,
  Subscription,
  Entitlement,
  Checkout,
  WebhookEndpoint,
  WebhookEvent,
  ApiKey,
  AuditLog,
  ProviderRef,
  OutboxEvent,
  DeadLetterEvent,
  IdempotencyKey,
} from '@prisma/client';

// Pagination types
export type { PaginatedResult, PaginationParams } from './types';

// Utility types for create/update operations
export type {
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
  CustomerCreateInput,
  CustomerUpdateInput,
  OfferCreateInput,
  OfferUpdateInput,
  OfferVersionCreateInput,
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
  EntitlementCreateInput,
  EntitlementUpdateInput,
  CheckoutCreateInput,
  CheckoutUpdateInput,
  WebhookEndpointCreateInput,
  WebhookEndpointUpdateInput,
  WebhookEventCreateInput,
  ApiKeyCreateInput,
  AuditLogCreateInput,
  ProviderRefCreateInput,
  OutboxEventCreateInput,
  DeadLetterEventCreateInput,
  IdempotencyKeyCreateInput,
} from './types';

// Repository interfaces
export type { WorkspaceRepository } from './repositories/workspace.repository';
export type { CustomerRepository } from './repositories/customer.repository';
export type { OfferRepository } from './repositories/offer.repository';
export type { SubscriptionRepository } from './repositories/subscription.repository';
export type { ProviderRefRepository } from './repositories/provider-ref.repository';
