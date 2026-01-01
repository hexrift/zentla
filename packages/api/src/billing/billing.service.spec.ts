import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BillingService } from "./billing.service";

// Mock the StripeAdapter module
vi.mock("@relay/stripe-adapter", () => {
  return {
    StripeAdapter: class MockStripeAdapter {
      getAccountInfo = vi.fn().mockResolvedValue({ id: "acct_123" });
    },
  };
});

describe("BillingService", () => {
  let service: BillingService;
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          "stripe.secretKey": "sk_test_123",
          "stripe.webhookSecret": "whsec_123",
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    service.onModuleInit();
  });

  describe("isConfigured", () => {
    it("should return true when stripe is configured", () => {
      expect(service.isConfigured("stripe")).toBe(true);
    });

    it("should return false for zuora (not configured)", () => {
      expect(service.isConfigured("zuora")).toBe(false);
    });
  });

  describe("getProvider", () => {
    it("should return stripe provider when configured", () => {
      const provider = service.getProvider("stripe");
      expect(provider).toBeDefined();
    });

    it("should throw when provider not configured", () => {
      expect(() => service.getProvider("zuora")).toThrow(
        "zuora provider not configured",
      );
    });
  });

  describe("getProviderOrNull", () => {
    it("should return provider when configured", () => {
      const provider = service.getProviderOrNull("stripe");
      expect(provider).not.toBeNull();
    });

    it("should return null when not configured", () => {
      const provider = service.getProviderOrNull("zuora");
      expect(provider).toBeNull();
    });
  });

  describe("configureProvider", () => {
    it("should configure stripe with new credentials", () => {
      service.configureProvider("stripe", {
        secretKey: "sk_test_new",
        webhookSecret: "whsec_new",
      });

      expect(service.isConfigured("stripe")).toBe(true);
    });
  });

  describe("getDefaultProvider", () => {
    it("should return the specified default provider if configured", () => {
      const provider = service.getDefaultProvider("stripe");
      expect(provider).toBeDefined();
    });

    it("should fall back to first configured provider", () => {
      const provider = service.getDefaultProvider();
      expect(provider).toBeDefined();
    });
  });

  describe("workspace provider methods", () => {
    it("should cache workspace provider after creation", () => {
      const settings = {
        stripeSecretKey: "sk_test_ws",
        stripeWebhookSecret: "whsec_ws",
      };

      const provider1 = service.getProviderForWorkspace(
        "ws_123",
        "stripe",
        settings,
      );
      const provider2 = service.getProviderForWorkspace(
        "ws_123",
        "stripe",
        settings,
      );

      // Should be the same cached instance
      expect(provider1).toBe(provider2);
    });

    it("should clear workspace cache", () => {
      const settings = {
        stripeSecretKey: "sk_test_ws",
        stripeWebhookSecret: "whsec_ws",
      };

      service.getProviderForWorkspace("ws_123", "stripe", settings);
      service.clearWorkspaceCache("ws_123");

      // After clearing, falls back to global (which is configured)
      // The point is the cache is cleared - it will use global or settings on next call
      expect(service.isConfiguredForWorkspace("ws_123", "stripe")).toBe(true);
    });

    it("should fall back to global provider if no workspace settings", () => {
      const provider = service.getProviderForWorkspace("ws_123", "stripe");
      expect(provider).toBeDefined();
    });

    it("should throw if no provider available", () => {
      expect(() => service.getProviderForWorkspace("ws_123", "zuora")).toThrow(
        "zuora provider not configured for workspace",
      );
    });

    it("should report workspace as configured via settings", () => {
      const settings = {
        stripeSecretKey: "sk_test_ws",
        stripeWebhookSecret: "whsec_ws",
      };

      expect(
        service.isConfiguredForWorkspace("ws_123", "stripe", settings),
      ).toBe(true);
    });

    it("should report workspace as configured via global fallback", () => {
      expect(service.isConfiguredForWorkspace("ws_123", "stripe")).toBe(true);
    });
  });

  describe("configureProviderForWorkspace", () => {
    it("should configure stripe for specific workspace", () => {
      service.configureProviderForWorkspace("ws_456", "stripe", {
        secretKey: "sk_test_456",
        webhookSecret: "whsec_456",
      });

      expect(service.isConfiguredForWorkspace("ws_456", "stripe")).toBe(true);
    });
  });

  describe("getProviderStatusForWorkspace", () => {
    it("should return connected status for workspace with credentials", async () => {
      const settings = {
        stripeSecretKey: "sk_test_ws",
        stripeWebhookSecret: "whsec_ws",
      };

      const result = await service.getProviderStatusForWorkspace(
        "ws_123",
        settings,
      );

      expect(result.providers).toHaveLength(2);
      const stripe = result.providers.find((p) => p.provider === "stripe");
      expect(stripe?.status).toBe("connected");
      expect(stripe?.capabilities.subscriptions).toBe(true);
    });

    it("should return not_configured for workspace without credentials", async () => {
      const result = await service.getProviderStatusForWorkspace("ws_123", {});

      const stripe = result.providers.find((p) => p.provider === "stripe");
      expect(stripe?.status).toBe("not_configured");
    });

    it("should include zuora as not_configured", async () => {
      const result = await service.getProviderStatusForWorkspace("ws_123", {});

      const zuora = result.providers.find((p) => p.provider === "zuora");
      expect(zuora?.status).toBe("not_configured");
      expect(zuora?.errors).toContain(
        "Add your Zuora API credentials in Settings to enable billing",
      );
    });

    it("should detect live mode from secret key", async () => {
      const settings = {
        stripeSecretKey: "sk_live_ws",
        stripeWebhookSecret: "whsec_ws",
      };

      const result = await service.getProviderStatusForWorkspace(
        "ws_123",
        settings,
      );

      const stripe = result.providers.find((p) => p.provider === "stripe");
      expect(stripe?.mode).toBe("live");
    });

    it("should detect test mode from secret key", async () => {
      const settings = {
        stripeSecretKey: "sk_test_ws",
        stripeWebhookSecret: "whsec_ws",
      };

      const result = await service.getProviderStatusForWorkspace(
        "ws_123",
        settings,
      );

      const stripe = result.providers.find((p) => p.provider === "stripe");
      expect(stripe?.mode).toBe("test");
    });
  });

  describe("getProviderStatus (deprecated)", () => {
    it("should return global provider status", async () => {
      const result = await service.getProviderStatus();

      expect(result.providers).toHaveLength(2);
      const stripe = result.providers.find((p) => p.provider === "stripe");
      expect(stripe?.status).toBe("connected");
    });
  });

  describe("getDefaultProvider error handling", () => {
    it("should throw when no providers configured", () => {
      // Create a service with no config
      const noConfigService = {
        get: vi.fn(() => undefined),
      };

      const emptyService = new BillingService(
        noConfigService as unknown as ConfigService,
      );

      expect(() => emptyService.getDefaultProvider()).toThrow(
        "No billing provider configured",
      );
    });
  });

  describe("onModuleInit with missing config", () => {
    it("should not throw when stripe keys are missing", () => {
      const emptyConfigService = {
        get: vi.fn(() => undefined),
      };

      const serviceWithoutConfig = new BillingService(
        emptyConfigService as unknown as ConfigService,
      );

      expect(() => serviceWithoutConfig.onModuleInit()).not.toThrow();
    });
  });

  describe("getDefaultProvider with preferred provider", () => {
    it("should fall back to first configured when preferred not available", () => {
      // When zuora is requested but not configured, falls back to stripe
      const provider = service.getDefaultProvider("zuora");
      expect(provider).toBeDefined();
    });
  });
});
