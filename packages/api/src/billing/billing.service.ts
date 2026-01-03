import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StripeAdapter } from "@zentla/stripe-adapter";
import { ZuoraAdapter } from "@zentla/zuora-adapter";
import type { BillingProvider } from "@zentla/core";

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

export interface WorkspaceSettings {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  zuoraClientId?: string;
  zuoraClientSecret?: string;
  zuoraBaseUrl?: string;
  zuoraWebhookSecret?: string;
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  // Global/fallback providers from env vars
  private readonly globalProviders = new Map<ProviderType, BillingProvider>();
  // Per-workspace provider cache: workspaceId -> providerType -> provider
  private readonly workspaceProviders = new Map<
    string,
    Map<ProviderType, BillingProvider>
  >();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.initializeGlobalStripe();
    // Future: this.initializeGlobalZuora();
  }

  private initializeGlobalStripe(): void {
    const secretKey = this.config.get<string>("stripe.secretKey");
    const webhookSecret = this.config.get<string>("stripe.webhookSecret");

    if (secretKey && webhookSecret) {
      const adapter = new StripeAdapter({ secretKey, webhookSecret });
      this.globalProviders.set("stripe", adapter);
      this.logger.log("Global Stripe provider initialized from env vars");
    }
  }

  // ============================================================================
  // Workspace-specific provider methods (preferred)
  // ============================================================================

  /**
   * Get or create a provider for a specific workspace.
   * Uses workspace settings first, falls back to global provider.
   */
  getProviderForWorkspace(
    workspaceId: string,
    provider: ProviderType,
    settings?: WorkspaceSettings,
  ): BillingProvider {
    // Check if we have a cached workspace-specific provider
    const workspaceCache = this.workspaceProviders.get(workspaceId);
    if (workspaceCache?.has(provider)) {
      return workspaceCache.get(provider)!;
    }

    // Try to create from workspace settings
    if (
      provider === "stripe" &&
      settings?.stripeSecretKey &&
      settings?.stripeWebhookSecret
    ) {
      const adapter = new StripeAdapter({
        secretKey: settings.stripeSecretKey,
        webhookSecret: settings.stripeWebhookSecret,
      });
      this.cacheWorkspaceProvider(workspaceId, provider, adapter);
      return adapter;
    }

    if (
      provider === "zuora" &&
      settings?.zuoraClientId &&
      settings?.zuoraClientSecret &&
      settings?.zuoraBaseUrl
    ) {
      const adapter = new ZuoraAdapter({
        clientId: settings.zuoraClientId,
        clientSecret: settings.zuoraClientSecret,
        baseUrl: settings.zuoraBaseUrl,
        webhookSecret: settings.zuoraWebhookSecret,
      });
      this.cacheWorkspaceProvider(workspaceId, provider, adapter);
      return adapter;
    }

    // Fall back to global provider
    const globalProvider = this.globalProviders.get(provider);
    if (globalProvider) {
      return globalProvider;
    }

    throw new Error(
      `${provider} provider not configured for workspace. Add credentials in Settings.`,
    );
  }

  /**
   * Check if a provider is configured for a specific workspace.
   */
  isConfiguredForWorkspace(
    workspaceId: string,
    provider: ProviderType,
    settings?: WorkspaceSettings,
  ): boolean {
    // Check workspace-specific
    const workspaceCache = this.workspaceProviders.get(workspaceId);
    if (workspaceCache?.has(provider)) {
      return true;
    }

    // Check workspace settings
    if (
      provider === "stripe" &&
      settings?.stripeSecretKey &&
      settings?.stripeWebhookSecret
    ) {
      return true;
    }

    if (
      provider === "zuora" &&
      settings?.zuoraClientId &&
      settings?.zuoraClientSecret &&
      settings?.zuoraBaseUrl
    ) {
      return true;
    }

    // Check global
    return this.globalProviders.has(provider);
  }

  /**
   * Configure a provider for a specific workspace.
   * Called when workspace settings are updated.
   */
  configureProviderForWorkspace(
    workspaceId: string,
    provider: ProviderType,
    config:
      | { secretKey: string; webhookSecret: string }
      | {
          clientId: string;
          clientSecret: string;
          baseUrl: string;
          webhookSecret?: string;
        },
  ): void {
    if (
      provider === "stripe" &&
      "secretKey" in config &&
      config.secretKey &&
      config.webhookSecret
    ) {
      const adapter = new StripeAdapter({
        secretKey: config.secretKey,
        webhookSecret: config.webhookSecret,
      });
      this.cacheWorkspaceProvider(workspaceId, provider, adapter);
      this.logger.log(
        `Stripe provider configured for workspace ${workspaceId}`,
      );
    }

    if (
      provider === "zuora" &&
      "clientId" in config &&
      config.clientId &&
      config.clientSecret &&
      config.baseUrl
    ) {
      const adapter = new ZuoraAdapter({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        baseUrl: config.baseUrl,
        webhookSecret: config.webhookSecret,
      });
      this.cacheWorkspaceProvider(workspaceId, provider, adapter);
      this.logger.log(`Zuora provider configured for workspace ${workspaceId}`);
    }
  }

  /**
   * Clear cached providers for a workspace.
   * Call when workspace credentials are updated.
   */
  clearWorkspaceCache(workspaceId: string): void {
    this.workspaceProviders.delete(workspaceId);
  }

  private cacheWorkspaceProvider(
    workspaceId: string,
    provider: ProviderType,
    adapter: BillingProvider,
  ): void {
    if (!this.workspaceProviders.has(workspaceId)) {
      this.workspaceProviders.set(workspaceId, new Map());
    }
    this.workspaceProviders.get(workspaceId)!.set(provider, adapter);
  }

  // ============================================================================
  // Global provider methods (for backward compatibility and webhooks)
  // ============================================================================

  /**
   * Configure a global provider with credentials.
   * @deprecated Use configureProviderForWorkspace() for workspace-specific config
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
      this.globalProviders.set("stripe", adapter);
      this.logger.log("Global Stripe provider reconfigured");
    }
  }

  /**
   * @deprecated Use configureProviderForWorkspace() instead
   */
  configureStripe(secretKey: string, webhookSecret: string): void {
    this.configureProvider("stripe", { secretKey, webhookSecret });
  }

  /**
   * Get a global billing provider by type.
   * @deprecated Use getProviderForWorkspace() for workspace-specific access
   */
  getProvider(provider: ProviderType): BillingProvider {
    const adapter = this.globalProviders.get(provider);
    if (!adapter) {
      throw new Error(
        `${provider} provider not configured. Check environment variables.`,
      );
    }
    return adapter;
  }

  /**
   * Get a global billing provider if configured, null otherwise.
   */
  getProviderOrNull(provider: ProviderType): BillingProvider | null {
    return this.globalProviders.get(provider) ?? null;
  }

  /**
   * @deprecated Use getProviderForWorkspace() instead
   */
  getStripeAdapter(): StripeAdapter {
    const adapter = this.globalProviders.get("stripe");
    if (!adapter) {
      throw new Error("Stripe provider not configured");
    }
    return adapter as StripeAdapter;
  }

  /**
   * Check if a global provider is configured.
   */
  isConfigured(provider: ProviderType): boolean {
    return this.globalProviders.has(provider);
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
    for (const [type] of this.globalProviders) {
      return this.getProvider(type);
    }

    throw new Error("No billing provider configured");
  }

  /**
   * Get status of all billing providers for a workspace.
   * Checks workspace-specific settings first, then falls back to global.
   */
  async getProviderStatusForWorkspace(
    workspaceId: string,
    settings?: WorkspaceSettings,
  ): Promise<{ providers: ProviderStatus[] }> {
    const statuses: ProviderStatus[] = [];

    // Check Stripe status for this workspace
    statuses.push(
      await this.getStripeStatusForWorkspace(workspaceId, settings),
    );

    // Check Zuora status for this workspace
    statuses.push(await this.getZuoraStatusForWorkspace(workspaceId, settings));

    return { providers: statuses };
  }

  /**
   * @deprecated Use getProviderStatusForWorkspace() instead
   */
  async getProviderStatus(): Promise<{ providers: ProviderStatus[] }> {
    const statuses: ProviderStatus[] = [];
    statuses.push(await this.getGlobalStripeStatus());
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
      errors: ["Zuora requires configuration - add credentials in Settings"],
    });
    return { providers: statuses };
  }

  private async getStripeStatusForWorkspace(
    workspaceId: string,
    settings?: WorkspaceSettings,
  ): Promise<ProviderStatus> {
    // Check if workspace has its own Stripe credentials
    const hasWorkspaceCredentials =
      settings?.stripeSecretKey && settings?.stripeWebhookSecret;

    if (!hasWorkspaceCredentials) {
      // No workspace-specific credentials
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
        errors: ["Add your Stripe API keys in Settings to enable billing"],
      };
    }

    // Try to get or create the workspace provider
    try {
      const adapter = this.getProviderForWorkspace(
        workspaceId,
        "stripe",
        settings,
      ) as StripeAdapter;

      await adapter.getAccountInfo();
      const isLiveMode = !settings.stripeSecretKey?.startsWith("sk_test");

      return {
        provider: "stripe",
        status: "connected",
        mode: isLiveMode ? "live" : "test",
        lastVerifiedAt: new Date(),
        capabilities: {
          subscriptions: true,
          invoices: true,
          customerPortal: true,
          webhooksConfigured: !!settings.stripeWebhookSecret,
        },
        errors: [],
      };
    } catch (error) {
      // Clear cache on error so next request tries fresh
      this.clearWorkspaceCache(workspaceId);

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

  private async getZuoraStatusForWorkspace(
    workspaceId: string,
    settings?: WorkspaceSettings,
  ): Promise<ProviderStatus> {
    // Check if workspace has Zuora credentials
    const hasWorkspaceCredentials =
      settings?.zuoraClientId &&
      settings?.zuoraClientSecret &&
      settings?.zuoraBaseUrl;

    if (!hasWorkspaceCredentials) {
      return {
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
        errors: [
          "Add your Zuora API credentials in Settings to enable billing",
        ],
      };
    }

    // Try to get or create the workspace provider
    try {
      const adapter = this.getProviderForWorkspace(
        workspaceId,
        "zuora",
        settings,
      ) as ZuoraAdapter;

      // Verify connection by getting account info (triggers OAuth)
      await adapter.getAccountInfo();
      const isSandbox = settings.zuoraBaseUrl?.includes("sandbox");

      return {
        provider: "zuora",
        status: "connected",
        mode: isSandbox ? "test" : "live",
        lastVerifiedAt: new Date(),
        capabilities: {
          subscriptions: true,
          invoices: true,
          customerPortal: true,
          webhooksConfigured: !!settings.zuoraWebhookSecret,
        },
        errors: [],
      };
    } catch (error) {
      // Clear cache on error so next request tries fresh
      this.clearWorkspaceCache(workspaceId);

      return {
        provider: "zuora",
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
            : "Unknown error connecting to Zuora",
        ],
      };
    }
  }

  private async getGlobalStripeStatus(): Promise<ProviderStatus> {
    const adapter = this.globalProviders.get("stripe") as
      | StripeAdapter
      | undefined;

    if (!adapter) {
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
        errors: ["STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET not set"],
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
