import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZuoraAdapter } from "./zuora.adapter";
import { validateZuoraConfig, ZUORA_ENVIRONMENTS } from "./zuora.config";

describe("ZuoraConfig", () => {
  describe("validateZuoraConfig", () => {
    it("should validate a complete config", () => {
      const config = validateZuoraConfig({
        clientId: "test-client-id",
        clientSecret: "test-secret",
        baseUrl: "https://rest.zuora.com",
      });

      expect(config.clientId).toBe("test-client-id");
      expect(config.clientSecret).toBe("test-secret");
      expect(config.baseUrl).toBe("https://rest.zuora.com");
      expect(config.apiVersion).toBe("v1");
    });

    it("should remove trailing slash from baseUrl", () => {
      const config = validateZuoraConfig({
        clientId: "test-client-id",
        clientSecret: "test-secret",
        baseUrl: "https://rest.zuora.com/",
      });

      expect(config.baseUrl).toBe("https://rest.zuora.com");
    });

    it("should throw if clientId is missing", () => {
      expect(() =>
        validateZuoraConfig({
          clientSecret: "test-secret",
          baseUrl: "https://rest.zuora.com",
        }),
      ).toThrow("Zuora client ID is required");
    });

    it("should throw if clientSecret is missing", () => {
      expect(() =>
        validateZuoraConfig({
          clientId: "test-client-id",
          baseUrl: "https://rest.zuora.com",
        }),
      ).toThrow("Zuora client secret is required");
    });

    it("should throw if baseUrl is missing", () => {
      expect(() =>
        validateZuoraConfig({
          clientId: "test-client-id",
          clientSecret: "test-secret",
        }),
      ).toThrow("Zuora base URL is required");
    });
  });

  describe("ZUORA_ENVIRONMENTS", () => {
    it("should have correct production URL", () => {
      expect(ZUORA_ENVIRONMENTS.production).toBe("https://rest.zuora.com");
    });

    it("should have correct sandbox URL", () => {
      expect(ZUORA_ENVIRONMENTS.sandbox).toBe(
        "https://rest.apisandbox.zuora.com",
      );
    });
  });
});

describe("ZuoraAdapter", () => {
  let adapter: ZuoraAdapter;

  beforeEach(() => {
    adapter = new ZuoraAdapter({
      clientId: "test-client-id",
      clientSecret: "test-secret",
      baseUrl: "https://rest.apisandbox.zuora.com",
      webhookSecret: "whsec_test",
    });
  });

  it("should have name set to zuora", () => {
    expect(adapter.name).toBe("zuora");
  });

  describe("verifyWebhook", () => {
    it("should verify a valid webhook signature", () => {
      const payload = Buffer.from('{"type":"test"}');
      // Create the expected signature
      const crypto = require("crypto");
      const signature = crypto
        .createHmac("sha256", "whsec_test")
        .update(payload)
        .digest("hex");

      expect(adapter.verifyWebhook(payload, signature)).toBe(true);
    });

    it("should reject an invalid webhook signature", () => {
      const payload = Buffer.from('{"type":"test"}');
      const signature = "invalid-signature";

      expect(adapter.verifyWebhook(payload, signature)).toBe(false);
    });
  });

  describe("normalizeEvent", () => {
    it("should normalize SubscriptionCreated event", () => {
      const event = {
        type: "SubscriptionCreated",
        subscriptionId: "sub_123",
        accountId: "acc_456",
        timestamp: "2024-01-15T10:00:00Z",
      };

      const normalized = adapter.normalizeEvent(event);

      expect(normalized).not.toBeNull();
      expect(normalized?.type).toBe("subscription.created");
      expect(normalized?.aggregateType).toBe("subscription");
      expect(normalized?.aggregateId).toBe("sub_123");
      expect((normalized?.data as Record<string, unknown>).subscriptionId).toBe(
        "sub_123",
      );
      expect(normalized?.metadata.provider).toBe("zuora");
    });

    it("should normalize SubscriptionCancelled event", () => {
      const event = {
        type: "SubscriptionCancelled",
        subscriptionId: "sub_123",
        accountId: "acc_456",
      };

      const normalized = adapter.normalizeEvent(event);

      expect(normalized?.type).toBe("subscription.canceled");
      expect((normalized?.data as Record<string, unknown>).status).toBe(
        "canceled",
      );
    });

    it("should normalize PaymentSuccess event", () => {
      const event = {
        type: "PaymentSuccess",
        invoiceId: "inv_123",
        paymentId: "pay_456",
        accountId: "acc_789",
      };

      const normalized = adapter.normalizeEvent(event);

      expect(normalized?.type).toBe("invoice.paid");
      expect(normalized?.aggregateType).toBe("invoice");
      expect((normalized?.data as Record<string, unknown>).invoiceId).toBe(
        "inv_123",
      );
    });

    it("should normalize PaymentFailed event", () => {
      const event = {
        type: "PaymentFailed",
        invoiceId: "inv_123",
        paymentId: "pay_456",
      };

      const normalized = adapter.normalizeEvent(event);

      expect(normalized?.type).toBe("invoice.payment_failed");
    });

    it("should return null for unknown event types", () => {
      const event = { type: "UnknownEvent" };

      expect(adapter.normalizeEvent(event)).toBeNull();
    });
  });
});

describe("ZuoraAdapter API methods", () => {
  let adapter: ZuoraAdapter;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();

    adapter = new ZuoraAdapter({
      clientId: "test-client-id",
      clientSecret: "test-secret",
      baseUrl: "https://rest.apisandbox.zuora.com",
    });
  });

  it("should authenticate before making API calls", async () => {
    // Mock OAuth token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "service",
        jti: "test-jti",
      }),
    });

    // Mock subscription response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sub_123",
        subscriptionNumber: "S-00001",
        status: "Active",
        termStartDate: "2024-01-01",
        termEndDate: "2024-12-31",
        ratePlans: [],
      }),
    });

    const subscription = await adapter.getSubscription({
      id: "ref_123",
      workspaceId: "ws_123",
      entityType: "subscription",
      entityId: "sub_123",
      provider: "zuora",
      externalId: "sub_123",
      createdAt: new Date(),
    });

    // Verify OAuth was called first
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("/oauth/token");

    expect(subscription.id).toBe("sub_123");
    expect(subscription.status).toBe("active");
  });

  it("should reuse token if not expired", async () => {
    // First call - OAuth + API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        expires_in: 3600,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sub_1",
        status: "Active",
        termStartDate: "2024-01-01",
        termEndDate: "2024-12-31",
        ratePlans: [],
      }),
    });

    // Second call - should reuse token (only API call)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sub_2",
        status: "Active",
        termStartDate: "2024-01-01",
        termEndDate: "2024-12-31",
        ratePlans: [],
      }),
    });

    const ref = {
      id: "ref_123",
      workspaceId: "ws_123",
      entityType: "subscription" as const,
      entityId: "sub_123",
      provider: "zuora" as const,
      externalId: "sub_123",
      createdAt: new Date(),
    };

    await adapter.getSubscription(ref);
    await adapter.getSubscription({ ...ref, externalId: "sub_456" });

    // OAuth should only be called once
    const oauthCalls = mockFetch.mock.calls.filter((call) =>
      call[0].includes("/oauth/token"),
    );
    expect(oauthCalls).toHaveLength(1);
  });
});
