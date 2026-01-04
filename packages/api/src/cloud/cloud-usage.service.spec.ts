import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { CloudUsageService } from "./cloud-usage.service";
import { CloudSubscriptionsService } from "./cloud-subscriptions.service";
import { PrismaService } from "../database/prisma.service";

describe("CloudUsageService", () => {
  let service: CloudUsageService;
  let subscriptionsService: {
    getWorkspaceLimits: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    cloudSubscription: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    cloudUsage: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    customer: {
      count: ReturnType<typeof vi.fn>;
    };
    webhookEndpoint: {
      count: ReturnType<typeof vi.fn>;
    };
    workspaceMembership: {
      count: ReturnType<typeof vi.fn>;
    };
  };

  const mockSubscription = {
    id: "sub_123",
    workspaceId: "ws_123",
    currentPeriodStart: new Date("2024-01-01"),
    currentPeriodEnd: new Date("2024-02-01"),
  };

  const mockUsage = {
    id: "usage_123",
    subscriptionId: "sub_123",
    workspaceId: "ws_123",
    periodStart: new Date("2024-01-01"),
    periodEnd: new Date("2024-02-01"),
    apiCalls: 500,
    customers: 50,
    webhooks: 5,
    events: 1000,
    teamMembers: 3,
    offersCreated: 10,
    apiCallsOverage: 0,
    overageAmount: 0,
  };

  const mockLimits = {
    maxWorkspaces: 3,
    maxCustomers: 100,
    maxApiCalls: 1000,
    maxWebhooks: 10,
    maxTeamMembers: 5,
    maxOffersPerMonth: 50,
    maxEventsPerMonth: 10000,
  };

  beforeEach(async () => {
    subscriptionsService = {
      getWorkspaceLimits: vi.fn(),
    };

    prisma = {
      cloudSubscription: {
        findUnique: vi.fn(),
      },
      cloudUsage: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      customer: {
        count: vi.fn(),
      },
      webhookEndpoint: {
        count: vi.fn(),
      },
      workspaceMembership: {
        count: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudUsageService,
        { provide: CloudSubscriptionsService, useValue: subscriptionsService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CloudUsageService>(CloudUsageService);
  });

  describe("getOrCreateCurrentUsage", () => {
    it("should return existing usage record", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);

      const result = await service.getOrCreateCurrentUsage("ws_123");

      expect(result).toEqual(mockUsage);
    });

    it("should create new usage record if none exists", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(null);
      prisma.cloudUsage.create.mockResolvedValue(mockUsage);

      const result = await service.getOrCreateCurrentUsage("ws_123");

      expect(result).toEqual(mockUsage);
      expect(prisma.cloudUsage.create).toHaveBeenCalled();
    });

    it("should return null if no subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);

      const result = await service.getOrCreateCurrentUsage("ws_123");

      expect(result).toBeNull();
    });
  });

  describe("incrementUsage", () => {
    it("should increment a usage metric", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      prisma.cloudUsage.update.mockResolvedValue({
        ...mockUsage,
        apiCalls: 501,
      });

      await service.incrementUsage("ws_123", "apiCalls");

      expect(prisma.cloudUsage.update).toHaveBeenCalledWith({
        where: { id: mockUsage.id },
        data: { apiCalls: { increment: 1 } },
      });
    });

    it("should increment by specified amount", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      prisma.cloudUsage.update.mockResolvedValue({
        ...mockUsage,
        events: 1010,
      });

      await service.incrementUsage("ws_123", "events", 10);

      expect(prisma.cloudUsage.update).toHaveBeenCalledWith({
        where: { id: mockUsage.id },
        data: { events: { increment: 10 } },
      });
    });
  });

  describe("setUsage", () => {
    it("should set a usage metric to absolute value", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      prisma.cloudUsage.update.mockResolvedValue({
        ...mockUsage,
        customers: 75,
      });

      await service.setUsage("ws_123", "customers", 75);

      expect(prisma.cloudUsage.update).toHaveBeenCalledWith({
        where: { id: mockUsage.id },
        data: { customers: 75 },
      });
    });
  });

  describe("getCurrentUsage", () => {
    it("should return current usage metrics", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);

      const result = await service.getCurrentUsage("ws_123");

      expect(result).toEqual({
        apiCalls: 500,
        customers: 50,
        webhooks: 5,
        events: 1000,
        teamMembers: 3,
        offersCreated: 10,
      });
    });

    it("should return zeros if no usage record", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);

      const result = await service.getCurrentUsage("ws_123");

      expect(result.apiCalls).toBe(0);
      expect(result.customers).toBe(0);
    });
  });

  describe("getUsageWithLimits", () => {
    it("should return usage with limits comparison", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.getUsageWithLimits("ws_123");

      expect(result.metrics.apiCalls).toBe(500);
      expect(result.limits.maxApiCalls).toBe(1000);
      expect(result.percentages.apiCalls).toBe(50);
    });

    it("should identify at-limit metrics", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue({
        ...mockUsage,
        teamMembers: 5, // At limit
      });
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.getUsageWithLimits("ws_123");

      expect(result.atLimit).toContain("teamMembers");
    });

    it("should identify over-limit metrics", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue({
        ...mockUsage,
        apiCalls: 1500, // Over limit
      });
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.getUsageWithLimits("ws_123");

      expect(result.overLimit).toContain("apiCalls");
    });
  });

  describe("checkLimit", () => {
    it("should allow when under limit", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.checkLimit("ws_123", "apiCalls");

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(500);
      expect(result.limit).toBe(1000);
    });

    it("should deny when at limit", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue({
        ...mockUsage,
        apiCalls: 1000,
      });
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.checkLimit("ws_123", "apiCalls");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("limit exceeded");
    });

    it("should allow unlimited resources", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      subscriptionsService.getWorkspaceLimits.mockResolvedValue({
        ...mockLimits,
        maxApiCalls: null, // Unlimited
      });

      const result = await service.checkLimit("ws_123", "apiCalls");

      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });

  describe("enforceLimit", () => {
    it("should not throw when under limit", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      await expect(
        service.enforceLimit("ws_123", "apiCalls"),
      ).resolves.not.toThrow();
    });

    it("should throw ForbiddenException when over limit", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue({
        ...mockUsage,
        apiCalls: 1000,
      });
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      await expect(service.enforceLimit("ws_123", "apiCalls")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("trackApiCall", () => {
    it("should enforce limit and increment usage", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      prisma.cloudUsage.update.mockResolvedValue({
        ...mockUsage,
        apiCalls: 501,
      });
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      await service.trackApiCall("ws_123");

      expect(prisma.cloudUsage.update).toHaveBeenCalled();
    });
  });

  describe("syncCustomerCount", () => {
    it("should sync customer count from database", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      prisma.customer.count.mockResolvedValue(75);
      prisma.cloudUsage.update.mockResolvedValue({
        ...mockUsage,
        customers: 75,
      });

      const result = await service.syncCustomerCount("ws_123");

      expect(result).toBe(75);
      expect(prisma.cloudUsage.update).toHaveBeenCalledWith({
        where: { id: mockUsage.id },
        data: { customers: 75 },
      });
    });
  });

  describe("calculateOverage", () => {
    it("should calculate API call overage", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue({
        ...mockUsage,
        apiCalls: 1500, // 500 over limit
      });
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.calculateOverage("ws_123");

      expect(result).toHaveLength(1);
      expect(result[0].metric).toBe("apiCalls");
      expect(result[0].overage).toBe(500);
      expect(result[0].charge).toBe(100); // 500 calls = 1 block of 1000 = $1
    });

    it("should return empty array when no overage", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudUsage.findUnique.mockResolvedValue(mockUsage);
      subscriptionsService.getWorkspaceLimits.mockResolvedValue(mockLimits);

      const result = await service.calculateOverage("ws_123");

      expect(result).toHaveLength(0);
    });
  });

  describe("getUsageHistory", () => {
    it("should return usage history", async () => {
      prisma.cloudUsage.findMany.mockResolvedValue([mockUsage]);

      const result = await service.getUsageHistory("ws_123");

      expect(result).toHaveLength(1);
      expect(prisma.cloudUsage.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          periodStart: { gte: expect.any(Date) },
        },
        orderBy: { periodStart: "desc" },
      });
    });
  });
});
