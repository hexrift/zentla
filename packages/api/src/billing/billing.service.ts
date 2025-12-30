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

  /**
   * Get status of all configured billing providers.
   * Used for onboarding and connection health checks.
   */
  async getProviderStatus(): Promise<{
    providers: Array<{
      provider: 'stripe' | 'zuora';
      status: 'connected' | 'disconnected' | 'error' | 'not_configured';
      mode: 'live' | 'test' | null;
      lastVerifiedAt: Date | null;
      capabilities: {
        subscriptions: boolean;
        invoices: boolean;
        customerPortal: boolean;
        webhooksConfigured: boolean;
      };
      errors: string[];
    }>;
  }> {
    const providers: Array<{
      provider: 'stripe' | 'zuora';
      status: 'connected' | 'disconnected' | 'error' | 'not_configured';
      mode: 'live' | 'test' | null;
      lastVerifiedAt: Date | null;
      capabilities: {
        subscriptions: boolean;
        invoices: boolean;
        customerPortal: boolean;
        webhooksConfigured: boolean;
      };
      errors: string[];
    }> = [];

    // Check Stripe status
    if (this.stripeAdapter) {
      try {
        // Verify connection by fetching account info
        await this.stripeAdapter.getAccountInfo();
        const isLiveMode = !this.config.get<string>('stripe.secretKey')?.startsWith('sk_test');

        providers.push({
          provider: 'stripe',
          status: 'connected',
          mode: isLiveMode ? 'live' : 'test',
          lastVerifiedAt: new Date(),
          capabilities: {
            subscriptions: true,
            invoices: true,
            customerPortal: true,
            webhooksConfigured: !!this.config.get<string>('stripe.webhookSecret'),
          },
          errors: [],
        });
      } catch (error) {
        providers.push({
          provider: 'stripe',
          status: 'error',
          mode: null,
          lastVerifiedAt: null,
          capabilities: {
            subscriptions: false,
            invoices: false,
            customerPortal: false,
            webhooksConfigured: false,
          },
          errors: [error instanceof Error ? error.message : 'Unknown error connecting to Stripe'],
        });
      }
    } else {
      const errors: string[] = [];
      if (!this.config.get<string>('stripe.secretKey')) {
        errors.push('STRIPE_SECRET_KEY environment variable not set');
      }
      if (!this.config.get<string>('stripe.webhookSecret')) {
        errors.push('STRIPE_WEBHOOK_SECRET environment variable not set');
      }

      providers.push({
        provider: 'stripe',
        status: 'not_configured',
        mode: null,
        lastVerifiedAt: null,
        capabilities: {
          subscriptions: false,
          invoices: false,
          customerPortal: false,
          webhooksConfigured: false,
        },
        errors,
      });
    }

    // Zuora placeholder (not yet implemented)
    providers.push({
      provider: 'zuora',
      status: 'not_configured',
      mode: null,
      lastVerifiedAt: null,
      capabilities: {
        subscriptions: false,
        invoices: false,
        customerPortal: false,
        webhooksConfigured: false,
      },
      errors: ['Zuora integration planned for future release'],
    });

    return { providers };
  }
}
