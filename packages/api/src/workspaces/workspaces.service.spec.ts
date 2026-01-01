import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";

describe("WorkspacesService", () => {
  let service: WorkspacesService;
  let prisma: {
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let billingService: {
    clearWorkspaceCache: ReturnType<typeof vi.fn>;
    configureProviderForWorkspace: ReturnType<typeof vi.fn>;
  };

  const mockWorkspace = {
    id: "ws_123",
    name: "Test Workspace",
    slug: "test-workspace",
    defaultProvider: "stripe" as const,
    settings: {
      defaultCurrency: "USD",
      webhookRetryPolicy: {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      workspace: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    billingService = {
      clearWorkspaceCache: vi.fn(),
      configureProviderForWorkspace: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  describe("findById", () => {
    it("should return workspace when found", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await service.findById("ws_123");

      expect(result).toEqual(mockWorkspace);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: "ws_123" },
      });
    });

    it("should return null when not found", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findBySlug", () => {
    it("should return workspace when found", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await service.findBySlug("test-workspace");

      expect(result).toEqual(mockWorkspace);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { slug: "test-workspace" },
      });
    });
  });

  describe("create", () => {
    it("should throw ConflictException if slug already exists", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      await expect(
        service.create({
          name: "New Workspace",
          slug: "test-workspace",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should create workspace with default settings", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      prisma.workspace.create.mockResolvedValue(mockWorkspace);

      const result = await service.create({
        name: "New Workspace",
        slug: "new-workspace",
      });

      expect(result).toEqual(mockWorkspace);
      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          name: "New Workspace",
          slug: "new-workspace",
          defaultProvider: "stripe",
          settings: expect.objectContaining({
            defaultCurrency: "USD",
            webhookRetryPolicy: expect.objectContaining({
              maxRetries: 5,
            }),
          }),
        },
      });
    });

    it("should create workspace with custom provider", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      prisma.workspace.create.mockResolvedValue({
        ...mockWorkspace,
        defaultProvider: "zuora",
      });

      await service.create({
        name: "Zuora Workspace",
        slug: "zuora-workspace",
        defaultProvider: "zuora",
      });

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          defaultProvider: "zuora",
        }),
      });
    });

    it("should create workspace with custom currency", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      prisma.workspace.create.mockResolvedValue(mockWorkspace);

      await service.create({
        name: "Euro Workspace",
        slug: "euro-workspace",
        defaultCurrency: "EUR",
      });

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          settings: expect.objectContaining({
            defaultCurrency: "EUR",
          }),
        }),
      });
    });
  });

  describe("update", () => {
    it("should throw NotFoundException when workspace not found", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update workspace name", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspace.update.mockResolvedValue({
        ...mockWorkspace,
        name: "Updated Name",
      });

      const result = await service.update("ws_123", { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
    });

    it("should update workspace provider", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspace.update.mockResolvedValue({
        ...mockWorkspace,
        defaultProvider: "zuora",
      });

      await service.update("ws_123", { defaultProvider: "zuora" });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws_123" },
        data: expect.objectContaining({
          defaultProvider: "zuora",
        }),
      });
    });

    it("should merge settings when updating", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspace.update.mockResolvedValue({
        ...mockWorkspace,
        settings: {
          ...mockWorkspace.settings,
          defaultCurrency: "EUR",
        },
      });

      await service.update("ws_123", {
        settings: { defaultCurrency: "EUR" },
      });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws_123" },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            defaultCurrency: "EUR",
            webhookRetryPolicy: mockWorkspace.settings.webhookRetryPolicy,
          }),
        }),
      });
    });

    it("should reconfigure billing when Stripe credentials updated", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspace.update.mockResolvedValue({
        ...mockWorkspace,
        settings: {
          ...mockWorkspace.settings,
          stripeSecretKey: "sk_test_123",
          stripeWebhookSecret: "whsec_123",
        },
      });

      await service.update("ws_123", {
        settings: {
          stripeSecretKey: "sk_test_123",
          stripeWebhookSecret: "whsec_123",
        },
      });

      expect(billingService.clearWorkspaceCache).toHaveBeenCalledWith("ws_123");
      expect(billingService.configureProviderForWorkspace).toHaveBeenCalledWith(
        "ws_123",
        "stripe",
        {
          secretKey: "sk_test_123",
          webhookSecret: "whsec_123",
        },
      );
    });

    it("should not reconfigure billing if only secret key is provided", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspace.update.mockResolvedValue({
        ...mockWorkspace,
        settings: {
          ...mockWorkspace.settings,
          stripeSecretKey: "sk_test_123",
        },
      });

      await service.update("ws_123", {
        settings: { stripeSecretKey: "sk_test_123" },
      });

      expect(billingService.clearWorkspaceCache).toHaveBeenCalled();
      expect(billingService.configureProviderForWorkspace).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should throw NotFoundException when workspace not found", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.delete("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should delete workspace", async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspace.delete.mockResolvedValue(mockWorkspace);

      await service.delete("ws_123");

      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: "ws_123" },
      });
    });
  });
});
