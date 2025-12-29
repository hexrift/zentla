export interface Workspace {
  id: string;
  name: string;
  slug: string;
  settings: WorkspaceSettings;
  defaultProvider: BillingProviderType;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceSettings {
  webhookRetryPolicy: RetryPolicy;
  defaultCurrency: string;
  stripeAccountId?: string;
  zuoraAccountId?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export type BillingProviderType = 'stripe' | 'zuora';
