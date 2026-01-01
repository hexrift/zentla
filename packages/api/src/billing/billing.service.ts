import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StripeAdapter } from "@relay/stripe-adapter";
import type { BillingProvider } from "@relay/core";

export type ProviderType = "stripe" | "zuora";

export interface ProviderStatus {
  provider: ProviderType;
  status: "connected" | "disconnected" | "error" | "not_configured";
  mode: "live" | "test" | null;
  lastVerifiedAt: Date | null;
  capabilities: {
    subscriptions: boolean;
    invoices: boolean;
    customerPortal: boolean;
    webhooksConfigured: boolean;
  };
  errors: string[];
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private readonly providers = new Map<ProviderType, BillingProvider>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.initializeStripe();
    // Future: this.initializeZuora();
  }

  private initializeStripe(): void {
    const secretKey = this.config.get<string>("stripe.secretKey");
    const webhookSecret = this.config.get<string>("stripe.webhookSecret");

    if (secretKey && webhookSecret) {
      const adapter = new StripeAdapter({ secretKey, webhookSecret });
      this.providers.set("stripe", adapter);
      this.logger.log("Stripe provider initialized");
    }
  }

  /**
   * Configure a provider with credentials.
   * Called when workspace settings are updated.
   */
  configureProvider(
    provider: ProviderType,
    config: { secretKey: string; webhookSecret: string },
  ): void {
    if (provider === "stripe" && config.secretKey && config.webhookSecret) {
      const adapter = new StripeAdapter({
        secretKey: config.secretKey,
        webhookSecret: config.webhookSecret,
      });
      this.providers.set("stripe", adapter);
      this.logger.log("Stripe provider reconfigured");
    }
    // Future: handle zuora configuration
  }

  /**
   * @deprecated Use configureProvider() instead
   */
  configureStripe(secretKey: string, webhookSecret: string): void {
    this.configureProvider("stripe", { secretKey, webhookSecret });
  }

  /**
   * Get a billing provider by type.
   * Throws if provider is not configured.
   */
  getProvider(provider: ProviderType): BillingProvider {
    const adapter = this.providers.get(provider);
    if (!adapter) {
      throw new Error(
        `${provider} provider not configured. Check environment variables.`,
      );
    }
    return adapter;
  }

  /**
   * Get a billing provider if configured, null otherwise.
   * Use this for optional provider operations.
   */
  getProviderOrNull(provider: ProviderType): BillingProvider | null {
    return this.providers.get(provider) ?? null;
  }

  /**
   * @deprecated Use getProvider("stripe") instead
   */
  getStripeAdapter(): StripeAdapter {
    const adapter = this.providers.get("stripe");
    if (!adapter) {
      throw new Error("Stripe provider not configured");
    }
    return adapter as StripeAdapter;
  }

  /**
   * Check if a provider is configured.
   */
  isConfigured(provider: ProviderType): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get the default provider for a workspace.
   * Falls back to first configured provider if workspace default not available.
   */
  getDefaultProvider(workspaceDefaultProvider?: ProviderType): BillingProvider {
    // Try workspace default first
    if (
      workspaceDefaultProvider &&
      this.isConfigured(workspaceDefaultProvider)
    ) {
      return this.getProvider(workspaceDefaultProvider);
    }

    // Fall back to first configured provider
    for (const [type] of this.providers) {
      return this.getProvider(type);
    }

    throw new Error("No billing provider configured");
  }

  /**
   * Get status of all billing providers.
   * Used for onboarding and connection health checks.
   */
  async getProviderStatus(): Promise<{ providers: ProviderStatus[] }> {
    const statuses: ProviderStatus[] = [];

    // Check Stripe status
    statuses.push(await this.getStripeStatus());

    // Zuora placeholder
    statuses.push({
      provider: "zuora",
      status: "not_configured",
      mode: null,
      lastVerifiedAt: null,
      capabilities: {
        subscriptions: false,
        invoices: false,
        customerPortal: false,
        webhooksConfigured: false,
      },
      errors: ["Zuora integration planned for future release"],
    });

    return { providers: statuses };
  }

  private async getStripeStatus(): Promise<ProviderStatus> {
    const adapter = this.providers.get("stripe") as StripeAdapter | undefined;

    if (!adapter) {
      const errors: string[] = [];
      if (!this.config.get<string>("stripe.secretKey")) {
        errors.push("STRIPE_SECRET_KEY not set");
      }
      if (!this.config.get<string>("stripe.webhookSecret")) {
        errors.push("STRIPE_WEBHOOK_SECRET not set");
      }

      return {
        provider: "stripe",
        status: "not_configured",
        mode: null,
        lastVerifiedAt: null,
        capabilities: {
          subscriptions: false,
          invoices: false,
          customerPortal: false,
          webhooksConfigured: false,
        },
        errors,
      };
    }

    try {
      await adapter.getAccountInfo();
      const isLiveMode = !this.config
        .get<string>("stripe.secretKey")
        ?.startsWith("sk_test");

      return {
        provider: "stripe",
        status: "connected",
        mode: isLiveMode ? "live" : "test",
        lastVerifiedAt: new Date(),
        capabilities: {
          subscriptions: true,
          invoices: true,
          customerPortal: true,
          webhooksConfigured: !!this.config.get<string>("stripe.webhookSecret"),
        },
        errors: [],
      };
    } catch (error) {
      return {
        provider: "stripe",
        status: "error",
        mode: null,
        lastVerifiedAt: null,
        capabilities: {
          subscriptions: false,
          invoices: false,
          customerPortal: false,
          webhooksConfigured: false,
        },
        errors: [
          error instanceof Error
            ? error.message
            : "Unknown error connecting to Stripe",
        ],
      };
    }
  }
}
