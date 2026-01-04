import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { CloudPlansService, DEFAULT_PLANS } from "./cloud-plans.service";
import { PrismaService } from "../database/prisma.service";

describe("CloudPlansService", () => {
  let service: CloudPlansService;
  let prisma: {
    cloudPlan: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const mockPlan = {
    id: "plan_123",
    key: "pro",
    name: "Pro",
    description: "Pro plan",
    tier: "pro",
    status: "active",
    monthlyPrice: 4900,
    yearlyPrice: 47000,
    maxWorkspaces: 3,
    maxCustomers: 1000,
    maxApiCalls: 50000,
    maxWebhooks: 10,
    maxTeamMembers: 5,
    maxOffersPerMonth: 50,
    maxEventsPerMonth: 50000,
    features: {
      analytics: true,
      experiments: false,
      advancedWebhooks: true,
    },
    trialDays: 14,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      cloudPlan: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudPlansService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CloudPlansService>(CloudPlansService);
  });

  describe("createPlan", () => {
    it("should create a new plan", async () => {
      prisma.cloudPlan.create.mockResolvedValue(mockPlan);

      const result = await service.createPlan({
        key: "pro",
        name: "Pro",
        tier: "pro",
        monthlyPrice: 4900,
        yearlyPrice: 47000,
        limits: { maxWorkspaces: 3 },
        features: { analytics: true },
      });

      expect(result.key).toBe("pro");
      expect(prisma.cloudPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: "pro",
          name: "Pro",
          tier: "pro",
          monthlyPrice: 4900,
        }),
      });
    });
  });

  describe("getPlan", () => {
    it("should return plan by ID", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.getPlan("plan_123");

      expect(result).toEqual(mockPlan);
      expect(prisma.cloudPlan.findUnique).toHaveBeenCalledWith({
        where: { id: "plan_123" },
      });
    });

    it("should return null if not found", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(null);

      const result = await service.getPlan("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getPlanByKey", () => {
    it("should return plan by key", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.getPlanByKey("pro");

      expect(result).toEqual(mockPlan);
      expect(prisma.cloudPlan.findUnique).toHaveBeenCalledWith({
        where: { key: "pro" },
      });
    });
  });

  describe("listPlans", () => {
    it("should list active plans", async () => {
      prisma.cloudPlan.findMany.mockResolvedValue([mockPlan]);

      const result = await service.listPlans();

      expect(result).toHaveLength(1);
      expect(prisma.cloudPlan.findMany).toHaveBeenCalledWith({
        where: { status: { in: ["active"] } },
        orderBy: { monthlyPrice: "asc" },
      });
    });

    it("should include hidden plans when requested", async () => {
      prisma.cloudPlan.findMany.mockResolvedValue([mockPlan]);

      await service.listPlans({ includeHidden: true });

      expect(prisma.cloudPlan.findMany).toHaveBeenCalledWith({
        where: { status: { in: ["active", "hidden"] } },
        orderBy: { monthlyPrice: "asc" },
      });
    });
  });

  describe("updatePlan", () => {
    it("should update plan properties", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.cloudPlan.update.mockResolvedValue({
        ...mockPlan,
        name: "Pro Plus",
      });

      const result = await service.updatePlan("plan_123", {
        name: "Pro Plus",
      });

      expect(result.name).toBe("Pro Plus");
      expect(prisma.cloudPlan.update).toHaveBeenCalledWith({
        where: { id: "plan_123" },
        data: expect.objectContaining({ name: "Pro Plus" }),
      });
    });

    it("should throw NotFoundException if plan not found", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePlan("nonexistent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deprecatePlan", () => {
    it("should set plan status to deprecated", async () => {
      prisma.cloudPlan.update.mockResolvedValue({
        ...mockPlan,
        status: "deprecated",
      });

      const result = await service.deprecatePlan("plan_123");

      expect(result.status).toBe("deprecated");
      expect(prisma.cloudPlan.update).toHaveBeenCalledWith({
        where: { id: "plan_123" },
        data: { status: "deprecated" },
      });
    });
  });

  describe("getPlanLimits", () => {
    it("should return plan limits", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(mockPlan);

      const limits = await service.getPlanLimits("plan_123");

      expect(limits).toEqual({
        maxWorkspaces: 3,
        maxCustomers: 1000,
        maxApiCalls: 50000,
        maxWebhooks: 10,
        maxTeamMembers: 5,
        maxOffersPerMonth: 50,
        maxEventsPerMonth: 50000,
      });
    });

    it("should throw NotFoundException if plan not found", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(null);

      await expect(service.getPlanLimits("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getPlanFeatures", () => {
    it("should return plan features", async () => {
      prisma.cloudPlan.findUnique.mockResolvedValue(mockPlan);

      const features = await service.getPlanFeatures("plan_123");

      expect(features).toEqual({
        analytics: true,
        experiments: false,
        advancedWebhooks: true,
      });
    });
  });

  describe("comparePlans", () => {
    const freePlan = {
      ...mockPlan,
      id: "plan_free",
      key: "free",
      tier: "free",
      monthlyPrice: 0,
      maxCustomers: 100,
      features: { analytics: false, experiments: false },
    };

    const proPlan = {
      ...mockPlan,
      id: "plan_pro",
      key: "pro",
      tier: "pro",
      monthlyPrice: 4900,
      maxCustomers: 1000,
      features: { analytics: true, experiments: false },
    };

    it("should detect upgrade", async () => {
      prisma.cloudPlan.findUnique
        .mockResolvedValueOnce(freePlan)
        .mockResolvedValueOnce(proPlan);

      const comparison = await service.comparePlans("plan_free", "plan_pro");

      expect(comparison.isUpgrade).toBe(true);
      expect(comparison.isDowngrade).toBe(false);
      expect(comparison.priceDifference).toBe(4900);
    });

    it("should detect downgrade", async () => {
      prisma.cloudPlan.findUnique
        .mockResolvedValueOnce(proPlan)
        .mockResolvedValueOnce(freePlan);

      const comparison = await service.comparePlans("plan_pro", "plan_free");

      expect(comparison.isUpgrade).toBe(false);
      expect(comparison.isDowngrade).toBe(true);
      expect(comparison.priceDifference).toBe(-4900);
    });

    it("should show limit changes", async () => {
      prisma.cloudPlan.findUnique
        .mockResolvedValueOnce(freePlan)
        .mockResolvedValueOnce(proPlan);

      const comparison = await service.comparePlans("plan_free", "plan_pro");

      expect(comparison.limitChanges.maxCustomers).toEqual({
        from: 100,
        to: 1000,
      });
    });

    it("should show feature changes", async () => {
      prisma.cloudPlan.findUnique
        .mockResolvedValueOnce(freePlan)
        .mockResolvedValueOnce(proPlan);

      const comparison = await service.comparePlans("plan_free", "plan_pro");

      expect(comparison.featureChanges.analytics).toEqual({
        from: false,
        to: true,
      });
    });
  });

  describe("DEFAULT_PLANS", () => {
    it("should have all required tiers", () => {
      const tiers = DEFAULT_PLANS.map((p) => p.tier);
      expect(tiers).toContain("free");
      expect(tiers).toContain("pro");
      expect(tiers).toContain("business");
      expect(tiers).toContain("enterprise");
    });

    it("should have increasing prices", () => {
      const prices = DEFAULT_PLANS.filter((p) => p.tier !== "enterprise").map(
        (p) => p.monthlyPrice,
      );
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });
  });
});
