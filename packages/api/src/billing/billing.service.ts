import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeAdapter } from '@relay/stripe-adapter';
import type { BillingProvider } from '@relay/core';

@Injectable()
export class BillingService implements OnModuleInit {
  private stripeAdapter: StripeAdapter | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const stripeSecretKey = this.config.get<string>('stripe.secretKey');
    const stripeWebhookSecret = this.config.get<string>('stripe.webhookSecret');

    if (stripeSecretKey && stripeWebhookSecret) {
      this.stripeAdapter = new StripeAdapter({
        secretKey: stripeSecretKey,
        webhookSecret: stripeWebhookSecret,
      });
    }
  }

  getProvider(provider: 'stripe' | 'zuora'): BillingProvider {
    if (provider === 'stripe') {
      if (!this.stripeAdapter) {
        throw new Error('Stripe adapter not configured. Check STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.');
      }
      return this.stripeAdapter;
    }

    throw new Error(`Provider ${provider} not implemented`);
  }

  getStripeAdapter(): StripeAdapter {
    if (!this.stripeAdapter) {
      throw new Error('Stripe adapter not configured');
    }
    return this.stripeAdapter;
  }

  isConfigured(provider: 'stripe' | 'zuora'): boolean {
    if (provider === 'stripe') {
      return this.stripeAdapter !== null;
    }
    return false;
  }
}
