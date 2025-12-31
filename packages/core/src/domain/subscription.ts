export interface Subscription {
  id: string;
  workspaceId: string;
  customerId: string;
  offerId: string;
  offerVersionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  endedAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type ProrationBehavior = "create_prorations" | "none" | "always_invoice";

export interface SubscriptionData {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  trialEnd?: Date;
  items: SubscriptionItem[];
}

export interface SubscriptionItem {
  id: string;
  priceId: string;
  quantity: number;
}
