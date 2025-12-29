export interface Checkout {
  id: string;
  workspaceId: string;
  customerId?: string;
  offerId: string;
  offerVersionId: string;
  status: CheckoutStatus;
  sessionUrl?: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type CheckoutStatus = 'pending' | 'open' | 'complete' | 'expired';

export interface CreateCheckoutParams {
  workspaceId: string;
  offerId: string;
  offerVersionId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  expiresAt: Date;
}

export interface PortalSession {
  id: string;
  url: string;
}

export interface CreatePortalSessionParams {
  workspaceId: string;
  customerId: string;
  returnUrl: string;
}
