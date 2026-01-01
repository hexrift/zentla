import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { StripeSyncService } from "./stripe-sync.service";
import { BillingService } from "../billing/billing.service";

describe("WorkspacesController", () => {
  let controller: WorkspacesController;
  let workspacesService: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let stripeSyncService: {
    syncFromStripe: ReturnType<typeof vi.fn>;
  };
  let billingService: {
    getProviderStatusForWorkspace: ReturnType<typeof vi.fn>;
  };

  const mockWorkspace = {
    id: "ws_123",
    name: "Test Workspace",
    slug: "test-workspace",
    defaultProvider: "stripe" as const,
    settings: {
      stripeSecretKey: "sk_test_123",
      stripeWebhookSecret: "whsec_123",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    workspacesService = {
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    stripeSyncService = {
      syncFromStripe: vi.fn(),
    };
    billingService = {
      getProviderStatusForWorkspace: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: StripeSyncService, useValue: stripeSyncService },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
  });

  describe("getCurrent", () => {
    it("should return current workspace", async () => {
      workspacesService.findById.mockResolvedValue(mockWorkspace);

      const result = await controller.getCurrent("ws_123");

      expect(result).toEqual(mockWorkspace);
      expect(workspacesService.findById).toHaveBeenCalledWith("ws_123");
    });
  });

  describe("getProviderStatus", () => {
    it("should return provider status", async () => {
      workspacesService.findById.mockResolvedValue(mockWorkspace);
      billingService.getProviderStatusForWorkspace.mockResolvedValue({
        providers: [
          {
            provider: "stripe",
            status: "connected",
            mode: "test",
            capabilities: { subscriptions: true, invoices: true, customerPortal: true, webhooksConfigured: true },
            errors: [],
          },
          {
            provider: "zuora",
            status: "not_configured",
            mode: null,
            capabilities: { subscriptions: false, invoices: false, customerPortal: false, webhooksConfigured: false },
            errors: ["Zuora integration planned for future release"],
          },
        ],
      });

      const result = await controller.getProviderStatus("ws_123");

      expect(result.defaultProvider).toBe("stripe");
      const stripe = result.providers.find((p: { provider: string }) => p.provider === "stripe");
      const zuora = result.providers.find((p: { provider: string }) => p.provider === "zuora");
      expect(stripe?.status).toBe("connected");
      expect(zuora?.status).toBe("not_configured");
    });

    it("should handle workspace without settings", async () => {
      workspacesService.findById.mockResolvedValue({
        ...mockWorkspace,
        settings: null,
      });
      billingService.getProviderStatusForWorkspace.mockResolvedValue({
        providers: [
          {
            provider: "stripe",
            status: "not_configured",
            mode: null,
            capabilities: { subscriptions: false, invoices: false, customerPortal: false, webhooksConfigured: false },
            errors: [],
          },
        ],
      });

      const result = await controller.getProviderStatus("ws_123");

      const stripe = result.providers.find((p: { provider: string }) => p.provider === "stripe");
      expect(stripe?.status).toBe("not_configured");
    });

    it("should use default provider when not specified", async () => {
      workspacesService.findById.mockResolvedValue({
        ...mockWorkspace,
        defaultProvider: undefined,
      });
      billingService.getProviderStatusForWorkspace.mockResolvedValue({
        providers: [
          {
            provider: "stripe",
            status: "connected",
            mode: "test",
            capabilities: { subscriptions: true, invoices: true, customerPortal: true, webhooksConfigured: true },
            errors: [],
          },
        ],
      });

      const result = await controller.getProviderStatus("ws_123");

      expect(result.defaultProvider).toBe("stripe");
    });
  });

  describe("updateCurrent", () => {
    it("should update workspace name", async () => {
      workspacesService.update.mockResolvedValue({
        ...mockWorkspace,
        name: "Updated Workspace",
      });

      const result = await controller.updateCurrent("ws_123", {
        name: "Updated Workspace",
      });

      expect(result.name).toBe("Updated Workspace");
      expect(workspacesService.update).toHaveBeenCalledWith("ws_123", {
        name: "Updated Workspace",
      });
    });

    it("should update default provider", async () => {
      workspacesService.update.mockResolvedValue({
        ...mockWorkspace,
        defaultProvider: "zuora",
      });

      const result = await controller.updateCurrent("ws_123", {
        defaultProvider: "zuora",
      });

      expect(result.defaultProvider).toBe("zuora");
    });

    it("should update workspace settings", async () => {
      workspacesService.update.mockResolvedValue({
        ...mockWorkspace,
        settings: { newSetting: true },
      });

      const result = await controller.updateCurrent("ws_123", {
        settings: { newSetting: true },
      });

      expect(result.settings).toEqual({ newSetting: true });
    });
  });

  describe("deleteCurrent", () => {
    it("should delete workspace", async () => {
      workspacesService.delete.mockResolvedValue(undefined);

      await controller.deleteCurrent("ws_123");

      expect(workspacesService.delete).toHaveBeenCalledWith("ws_123");
    });
  });

  describe("syncFromStripe", () => {
    it("should sync from Stripe", async () => {
      const syncResult = {
        customersImported: 10,
        customersSkipped: 2,
        subscriptionsImported: 8,
        subscriptionsSkipped: 1,
        errors: [],
      };
      stripeSyncService.syncFromStripe.mockResolvedValue(syncResult);

      const result = await controller.syncFromStripe("ws_123");

      expect(result).toEqual(syncResult);
      expect(stripeSyncService.syncFromStripe).toHaveBeenCalledWith("ws_123");
    });

    it("should return errors from sync", async () => {
      const syncResult = {
        customersImported: 5,
        customersSkipped: 0,
        subscriptionsImported: 3,
        subscriptionsSkipped: 2,
        errors: ["Price price_123 not found in Relay"],
      };
      stripeSyncService.syncFromStripe.mockResolvedValue(syncResult);

      const result = await controller.syncFromStripe("ws_123");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Price price_123 not found");
    });
  });
});
