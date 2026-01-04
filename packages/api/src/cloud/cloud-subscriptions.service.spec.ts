import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { CloudSubscriptionsService } from "./cloud-subscriptions.service";
import { CloudPlansService } from "./cloud-plans.service";
import { PrismaService } from "../database/prisma.service";

describe("CloudSubscriptionsService", () => {
  let service: CloudSubscriptionsService;
  let plansService: {
    getPlanByKey: ReturnType<typeof vi.fn>;
    getPlanLimits: ReturnType<typeof vi.fn>;
    comparePlans: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    cloudSubscription: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const mockPlan = {
    id: "plan_pro",
    key: "pro",
    name: "Pro",
    tier: "pro",
    monthlyPrice: 4900,
    yearlyPrice: 47000,
    trialDays: 14,
  };

  const mockSubscription = {
    id: "sub_123",
    workspaceId: "ws_123",
    planId: "plan_pro",
    status: "active",
    billingInterval: "monthly",
    currentPeriodStart: new Date("2024-01-01"),
    currentPeriodEnd: new Date("2024-02-01"),
    trialStart: null,
    trialEnd: null,
    cancelAt: null,
    canceledAt: null,
    metadata: {},
    plan: mockPlan,
  };

  beforeEach(async () => {
    plansService = {
      getPlanByKey: vi.fn(),
      getPlanLimits: vi.fn(),
      comparePlans: vi.fn(),
    };

    prisma = {
      cloudSubscription: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudSubscriptionsService,
        { provide: CloudPlansService, useValue: plansService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CloudSubscriptionsService>(CloudSubscriptionsService);
  });

  describe("createSubscription", () => {
    it("should create a new subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);
      plansService.getPlanByKey.mockResolvedValue(mockPlan);
      prisma.cloudSubscription.create.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription({
        workspaceId: "ws_123",
        planKey: "pro",
      });

      expect(result.workspaceId).toBe("ws_123");
      expect(result.plan.key).toBe("pro");
      expect(prisma.cloudSubscription.create).toHaveBeenCalled();
    });

    it("should start trial when requested", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);
      plansService.getPlanByKey.mockResolvedValue({
        ...mockPlan,
        trialDays: 14,
      });
      prisma.cloudSubscription.create.mockResolvedValue({
        ...mockSubscription,
        status: "trialing",
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const result = await service.createSubscription({
        workspaceId: "ws_123",
        planKey: "pro",
        startTrial: true,
      });

      expect(result.status).toBe("trialing");
      expect(result.trialEnd).not.toBeNull();
    });

    it("should throw if workspace already has subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);

      await expect(
        service.createSubscription({
          workspaceId: "ws_123",
          planKey: "pro",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if plan not found", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);
      plansService.getPlanByKey.mockResolvedValue(null);

      await expect(
        service.createSubscription({
          workspaceId: "ws_123",
          planKey: "nonexistent",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getSubscription", () => {
    it("should return subscription with plan", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.getSubscription("ws_123");

      expect(result).not.toBeNull();
      expect(result!.workspaceId).toBe("ws_123");
      expect(result!.plan.key).toBe("pro");
    });

    it("should return null if not found", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);

      const result = await service.getSubscription("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("changePlan", () => {
    it("should change plan immediately for upgrades", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      plansService.getPlanByKey.mockResolvedValue({
        ...mockPlan,
        id: "plan_business",
        key: "business",
        tier: "business",
      });
      plansService.comparePlans.mockResolvedValue({
        isUpgrade: true,
        isDowngrade: false,
        priceDifference: 15000,
      });
      prisma.cloudSubscription.update.mockResolvedValue({
        ...mockSubscription,
        planId: "plan_business",
        plan: { ...mockPlan, key: "business" },
      });

      const result = await service.changePlan("ws_123", {
        newPlanKey: "business",
      });

      expect(result.plan.key).toBe("business");
    });

    it("should throw if already on same plan", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      plansService.getPlanByKey.mockResolvedValue(mockPlan);

      await expect(
        service.changePlan("ws_123", { newPlanKey: "pro" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if subscription not found", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.changePlan("ws_123", { newPlanKey: "business" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancelSubscription", () => {
    it("should schedule cancellation at period end", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudSubscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAt: mockSubscription.currentPeriodEnd,
        canceledAt: new Date(),
      });

      const result = await service.cancelSubscription("ws_123");

      expect(result.cancelAt).not.toBeNull();
    });

    it("should cancel immediately when requested", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.cloudSubscription.update.mockResolvedValue({
        ...mockSubscription,
        status: "canceled",
        cancelAt: new Date(),
        canceledAt: new Date(),
      });

      const result = await service.cancelSubscription("ws_123", {
        immediately: true,
      });

      expect(result.status).toBe("canceled");
    });

    it("should throw if already canceled", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: "canceled",
      });

      await expect(service.cancelSubscription("ws_123")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("reactivateSubscription", () => {
    it("should clear cancellation schedule", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        cancelAt: new Date(),
        canceledAt: new Date(),
      });
      prisma.cloudSubscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAt: null,
        canceledAt: null,
      });

      const result = await service.reactivateSubscription("ws_123");

      expect(result.cancelAt).toBeNull();
    });

    it("should throw if not scheduled to cancel", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);

      await expect(service.reactivateSubscription("ws_123")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("isActive", () => {
    it("should return true for active subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.isActive("ws_123");

      expect(result).toBe(true);
    });

    it("should return true for trialing subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: "trialing",
      });

      const result = await service.isActive("ws_123");

      expect(result).toBe(true);
    });

    it("should return false for canceled subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: "canceled",
      });

      const result = await service.isActive("ws_123");

      expect(result).toBe(false);
    });

    it("should return false if no subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);

      const result = await service.isActive("ws_123");

      expect(result).toBe(false);
    });
  });

  describe("hasFeature", () => {
    it("should return true if feature enabled", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: { ...mockPlan, features: { analytics: true } },
      });

      const result = await service.hasFeature("ws_123", "analytics");

      expect(result).toBe(true);
    });

    it("should return false if feature disabled", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: { ...mockPlan, features: { analytics: false } },
      });

      const result = await service.hasFeature("ws_123", "analytics");

      expect(result).toBe(false);
    });

    it("should return false if no subscription", async () => {
      prisma.cloudSubscription.findUnique.mockResolvedValue(null);

      const result = await service.hasFeature("ws_123", "analytics");

      expect(result).toBe(false);
    });
  });

  describe("getExpiringSoon", () => {
    it("should find trials expiring within days", async () => {
      const expiringTrial = {
        ...mockSubscription,
        status: "trialing",
        trialEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      };
      prisma.cloudSubscription.findMany.mockResolvedValue([expiringTrial]);

      const result = await service.getExpiringSoon(7);

      expect(result).toHaveLength(1);
    });
  });
});
