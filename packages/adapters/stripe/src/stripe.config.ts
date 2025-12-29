export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;
  apiVersion?: string;
}

export function validateStripeConfig(config: Partial<StripeConfig>): StripeConfig {
  if (!config.secretKey) {
    throw new Error('Stripe secret key is required');
  }
  if (!config.webhookSecret) {
    throw new Error('Stripe webhook secret is required');
  }

  return {
    secretKey: config.secretKey,
    webhookSecret: config.webhookSecret,
    publishableKey: config.publishableKey,
    apiVersion: config.apiVersion ?? '2023-10-16',
  };
}
