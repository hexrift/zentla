export interface Entitlement {
  id: string;
  workspaceId: string;
  customerId: string;
  subscriptionId: string;
  featureKey: string;
  value: string | number | boolean;
  valueType: EntitlementValueType;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EntitlementValueType = 'boolean' | 'number' | 'string' | 'unlimited';

export interface EntitlementCheck {
  featureKey: string;
  hasAccess: boolean;
  value?: string | number | boolean;
  limit?: number;
  used?: number;
  remaining?: number;
}

export interface CustomerEntitlements {
  customerId: string;
  entitlements: EntitlementCheck[];
  activeSubscriptions: string[];
}

export interface CheckEntitlementInput {
  customerId: string;
  featureKey: string;
}

export interface BulkCheckEntitlementInput {
  customerId: string;
  featureKeys: string[];
}
