import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { CloudPlanTier, CloudPlanStatus } from "@prisma/client";

/**
 * Plan limits configuration.
 */
export interface PlanLimits {
  maxWorkspaces: number | null;
  maxCustomers: number | null;
  maxApiCalls: number | null;
  maxWebhooks: number | null;
  maxTeamMembers: number | null;
  maxOffersPerMonth: number | null;
  maxEventsPerMonth: number | null;
}

/**
 * Plan features configuration.
 */
export interface PlanFeatures {
  analytics: boolean;
  experiments: boolean;
  advancedWebhooks: boolean;
  customDomain: boolean;
  sso: boolean;
  auditLogs: boolean;
  prioritySupport: boolean;
  dedicatedSuccess: boolean;
}

/**
 * Options for creating a plan.
 */
export interface CreatePlanOptions {
  key: string;
  name: string;
  description?: string;
  tier: CloudPlanTier;
  monthlyPrice: number;
  yearlyPrice: number;
  limits: Partial<PlanLimits>;
  features: Partial<PlanFeatures>;
  trialDays?: number;
}

/**
 * Options for updating a plan.
 */
export interface UpdatePlanOptions {
  name?: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  limits?: Partial<PlanLimits>;
  features?: Partial<PlanFeatures>;
  trialDays?: number;
  status?: CloudPlanStatus;
}

/**
 * Default plan configurations.
 */
export const DEFAULT_PLANS: CreatePlanOptions[] = [
  {
    key: "free",
    name: "Free",
    description: "Get started with basic monetization features",
    tier: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      maxWorkspaces: 1,
      maxCustomers: 100,
      maxApiCalls: 1000,
      maxWebhooks: 2,
      maxTeamMembers: 1,
      maxOffersPerMonth: 5,
      maxEventsPerMonth: 1000,
    },
    features: {
      analytics: false,
      experiments: false,
      advancedWebhooks: false,
      customDomain: false,
      sso: false,
      auditLogs: false,
      prioritySupport: false,
      dedicatedSuccess: false,
    },
    trialDays: 0,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For growing businesses with advanced needs",
    tier: "pro",
    monthlyPrice: 4900, // $49/month
    yearlyPrice: 47000, // $470/year (~20% discount)
    limits: {
      maxWorkspaces: 3,
      maxCustomers: 1000,
      maxApiCalls: 50000,
      maxWebhooks: 10,
      maxTeamMembers: 5,
      maxOffersPerMonth: 50,
      maxEventsPerMonth: 50000,
    },
    features: {
      analytics: true,
      experiments: false,
      advancedWebhooks: true,
      customDomain: false,
      sso: false,
      auditLogs: true,
      prioritySupport: false,
      dedicatedSuccess: false,
    },
    trialDays: 14,
  },
  {
    key: "business",
    name: "Business",
    description: "For scaling teams with enterprise requirements",
    tier: "business",
    monthlyPrice: 19900, // $199/month
    yearlyPrice: 190000, // $1900/year (~20% discount)
    limits: {
      maxWorkspaces: 10,
      maxCustomers: 10000,
      maxApiCalls: 500000,
      maxWebhooks: 50,
      maxTeamMembers: 20,
      maxOffersPerMonth: null, // Unlimited
      maxEventsPerMonth: 500000,
    },
    features: {
      analytics: true,
      experiments: true,
      advancedWebhooks: true,
      customDomain: true,
      sso: false,
      auditLogs: true,
      prioritySupport: true,
      dedicatedSuccess: false,
    },
    trialDays: 14,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    tier: "enterprise",
    monthlyPrice: 0, // Custom pricing
    yearlyPrice: 0, // Custom pricing
    limits: {
      maxWorkspaces: null, // Unlimited
      maxCustomers: null, // Unlimited
      maxApiCalls: null, // Unlimited
      maxWebhooks: null, // Unlimited
      maxTeamMembers: null, // Unlimited
      maxOffersPerMonth: null, // Unlimited
      maxEventsPerMonth: null, // Unlimited
    },
    features: {
      analytics: true,
      experiments: true,
      advancedWebhooks: true,
      customDomain: true,
      sso: true,
      auditLogs: true,
      prioritySupport: true,
      dedicatedSuccess: true,
    },
    trialDays: 30,
  },
];

@Injectable()
export class CloudPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new cloud plan.
   */
  async createPlan(options: CreatePlanOptions) {
    return this.prisma.cloudPlan.create({
      data: {
        key: options.key,
        name: options.name,
        description: options.description,
        tier: options.tier,
        status: "active",
        monthlyPrice: options.monthlyPrice,
        yearlyPrice: options.yearlyPrice,
        maxWorkspaces: options.limits.maxWorkspaces ?? null,
        maxCustomers: options.limits.maxCustomers ?? null,
        maxApiCalls: options.limits.maxApiCalls ?? null,
        maxWebhooks: options.limits.maxWebhooks ?? null,
        maxTeamMembers: options.limits.maxTeamMembers ?? null,
        maxOffersPerMonth: options.limits.maxOffersPerMonth ?? null,
        maxEventsPerMonth: options.limits.maxEventsPerMonth ?? null,
        features: options.features as object,
        trialDays: options.trialDays ?? 0,
      },
    });
  }

  /**
   * Get a plan by ID.
   */
  async getPlan(planId: string) {
    return this.prisma.cloudPlan.findUnique({
      where: { id: planId },
    });
  }

  /**
   * Get a plan by key.
   */
  async getPlanByKey(key: string) {
    return this.prisma.cloudPlan.findUnique({
      where: { key },
    });
  }

  /**
   * List all active plans.
   */
  async listPlans(options?: { includeHidden?: boolean }) {
    const statuses: CloudPlanStatus[] = options?.includeHidden
      ? ["active", "hidden"]
      : ["active"];

    return this.prisma.cloudPlan.findMany({
      where: { status: { in: statuses } },
      orderBy: { monthlyPrice: "asc" },
    });
  }

  /**
   * Update a plan.
   */
  async updatePlan(planId: string, options: UpdatePlanOptions) {
    const plan = await this.prisma.cloudPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    const currentFeatures = plan.features as unknown as PlanFeatures;

    return this.prisma.cloudPlan.update({
      where: { id: planId },
      data: {
        name: options.name,
        description: options.description,
        monthlyPrice: options.monthlyPrice,
        yearlyPrice: options.yearlyPrice,
        maxWorkspaces: options.limits?.maxWorkspaces,
        maxCustomers: options.limits?.maxCustomers,
        maxApiCalls: options.limits?.maxApiCalls,
        maxWebhooks: options.limits?.maxWebhooks,
        maxTeamMembers: options.limits?.maxTeamMembers,
        maxOffersPerMonth: options.limits?.maxOffersPerMonth,
        maxEventsPerMonth: options.limits?.maxEventsPerMonth,
        features: options.features
          ? ({ ...currentFeatures, ...options.features } as object)
          : undefined,
        trialDays: options.trialDays,
        status: options.status,
      },
    });
  }

  /**
   * Deprecate a plan.
   */
  async deprecatePlan(planId: string) {
    return this.prisma.cloudPlan.update({
      where: { id: planId },
      data: { status: "deprecated" },
    });
  }

  /**
   * Get plan limits.
   */
  async getPlanLimits(planId: string): Promise<PlanLimits> {
    const plan = await this.prisma.cloudPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    return {
      maxWorkspaces: plan.maxWorkspaces,
      maxCustomers: plan.maxCustomers,
      maxApiCalls: plan.maxApiCalls,
      maxWebhooks: plan.maxWebhooks,
      maxTeamMembers: plan.maxTeamMembers,
      maxOffersPerMonth: plan.maxOffersPerMonth,
      maxEventsPerMonth: plan.maxEventsPerMonth,
    };
  }

  /**
   * Get plan features.
   */
  async getPlanFeatures(planId: string): Promise<PlanFeatures> {
    const plan = await this.prisma.cloudPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    return plan.features as unknown as PlanFeatures;
  }

  /**
   * Seed default plans.
   */
  async seedDefaultPlans() {
    for (const planConfig of DEFAULT_PLANS) {
      const existing = await this.getPlanByKey(planConfig.key);
      if (!existing) {
        await this.createPlan(planConfig);
      }
    }
  }

  /**
   * Compare two plans.
   */
  async comparePlans(
    fromPlanId: string,
    toPlanId: string,
  ): Promise<{
    isUpgrade: boolean;
    isDowngrade: boolean;
    priceDifference: number;
    limitChanges: Record<string, { from: number | null; to: number | null }>;
    featureChanges: Record<string, { from: boolean; to: boolean }>;
  }> {
    const [fromPlan, toPlan] = await Promise.all([
      this.getPlan(fromPlanId),
      this.getPlan(toPlanId),
    ]);

    if (!fromPlan || !toPlan) {
      throw new NotFoundException("One or both plans not found");
    }

    const tierOrder = { free: 0, pro: 1, business: 2, enterprise: 3 };
    const isUpgrade = tierOrder[toPlan.tier] > tierOrder[fromPlan.tier];
    const isDowngrade = tierOrder[toPlan.tier] < tierOrder[fromPlan.tier];

    const limitKeys: (keyof PlanLimits)[] = [
      "maxWorkspaces",
      "maxCustomers",
      "maxApiCalls",
      "maxWebhooks",
      "maxTeamMembers",
      "maxOffersPerMonth",
      "maxEventsPerMonth",
    ];

    const limitChanges: Record<
      string,
      { from: number | null; to: number | null }
    > = {};
    for (const key of limitKeys) {
      const fromValue = fromPlan[key];
      const toValue = toPlan[key];
      if (fromValue !== toValue) {
        limitChanges[key] = { from: fromValue, to: toValue };
      }
    }

    const fromFeatures = fromPlan.features as unknown as PlanFeatures;
    const toFeatures = toPlan.features as unknown as PlanFeatures;
    const featureKeys = Object.keys(fromFeatures) as (keyof PlanFeatures)[];

    const featureChanges: Record<string, { from: boolean; to: boolean }> = {};
    for (const key of featureKeys) {
      if (fromFeatures[key] !== toFeatures[key]) {
        featureChanges[key] = { from: fromFeatures[key], to: toFeatures[key] };
      }
    }

    return {
      isUpgrade,
      isDowngrade,
      priceDifference: toPlan.monthlyPrice - fromPlan.monthlyPrice,
      limitChanges,
      featureChanges,
    };
  }
}
