import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Entitlement, EntitlementValueType } from "@prisma/client";

export interface EntitlementCheck {
  featureKey: string;
  hasAccess: boolean;
  value?: string | number | boolean;
  valueType?: EntitlementValueType;
}

export interface CustomerEntitlements {
  customerId: string;
  entitlements: EntitlementCheck[];
  activeSubscriptionIds: string[];
}

interface CacheEntry {
  data: EntitlementCheck | CustomerEntitlements;
  expiresAt: number;
}

// In-memory cache for fast entitlement checks (<50ms target)
const CACHE_TTL_MS = 30_000; // 30 seconds
const entitlementCache = new Map<string, CacheEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of entitlementCache.entries()) {
    if (entry.expiresAt < now) {
      entitlementCache.delete(key);
    }
  }
}, 60_000); // Clean every minute

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  private getCacheKey(
    workspaceId: string,
    customerId: string,
    featureKey?: string,
  ): string {
    return featureKey
      ? `ent:${workspaceId}:${customerId}:${featureKey}`
      : `ent:${workspaceId}:${customerId}:all`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = entitlementCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    if (entry) {
      entitlementCache.delete(key);
    }
    return null;
  }

  private setCache(
    key: string,
    data: EntitlementCheck | CustomerEntitlements,
  ): void {
    entitlementCache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Invalidate cache for a customer (call when entitlements change)
   */
  invalidateCustomerCache(workspaceId: string, customerId: string): void {
    const prefix = `ent:${workspaceId}:${customerId}:`;
    for (const key of entitlementCache.keys()) {
      if (key.startsWith(prefix)) {
        entitlementCache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache (used for testing)
   */
  clearCache(): void {
    entitlementCache.clear();
  }

  async checkEntitlement(
    workspaceId: string,
    customerId: string,
    featureKey: string,
  ): Promise<EntitlementCheck> {
    // Check cache first for <50ms response
    const cacheKey = this.getCacheKey(workspaceId, customerId, featureKey);
    const cached = this.getFromCache<EntitlementCheck>(cacheKey);
    if (cached) {
      return cached;
    }

    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        workspaceId,
        customerId,
        featureKey,
        subscription: {
          status: { in: ["active", "trialing"] },
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    let result: EntitlementCheck;
    if (!entitlement) {
      result = {
        featureKey,
        hasAccess: false,
      };
    } else {
      result = {
        featureKey,
        hasAccess: true,
        value: this.parseEntitlementValue(
          entitlement.value,
          entitlement.valueType,
        ),
        valueType: entitlement.valueType,
      };
    }

    this.setCache(cacheKey, result);
    return result;
  }

  async checkMultipleEntitlements(
    workspaceId: string,
    customerId: string,
    featureKeys: string[],
  ): Promise<EntitlementCheck[]> {
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        workspaceId,
        customerId,
        featureKey: { in: featureKeys },
        subscription: {
          status: { in: ["active", "trialing"] },
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const entitlementMap = new Map(entitlements.map((e) => [e.featureKey, e]));

    return featureKeys.map((featureKey) => {
      const entitlement = entitlementMap.get(featureKey);
      if (!entitlement) {
        return { featureKey, hasAccess: false };
      }
      return {
        featureKey,
        hasAccess: true,
        value: this.parseEntitlementValue(
          entitlement.value,
          entitlement.valueType,
        ),
        valueType: entitlement.valueType,
      };
    });
  }

  async getCustomerEntitlements(
    workspaceId: string,
    customerId: string,
  ): Promise<CustomerEntitlements> {
    // Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // Get active subscriptions
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        workspaceId,
        customerId,
        status: { in: ["active", "trialing"] },
      },
      select: { id: true },
    });

    // Get all entitlements
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        workspaceId,
        customerId,
        subscription: {
          status: { in: ["active", "trialing"] },
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return {
      customerId,
      entitlements: entitlements.map((e) => ({
        featureKey: e.featureKey,
        hasAccess: true,
        value: this.parseEntitlementValue(e.value, e.valueType),
        valueType: e.valueType,
      })),
      activeSubscriptionIds: subscriptions.map((s) => s.id),
    };
  }

  async grantEntitlement(
    workspaceId: string,
    customerId: string,
    subscriptionId: string,
    featureKey: string,
    value: string,
    valueType: EntitlementValueType,
    expiresAt?: Date,
  ): Promise<Entitlement> {
    const result = await this.prisma.entitlement.upsert({
      where: {
        subscriptionId_featureKey: {
          subscriptionId,
          featureKey,
        },
      },
      create: {
        workspaceId,
        customerId,
        subscriptionId,
        featureKey,
        value,
        valueType,
        expiresAt,
      },
      update: {
        value,
        valueType,
        expiresAt,
      },
    });

    // Invalidate cache on entitlement change
    this.invalidateCustomerCache(workspaceId, customerId);
    return result;
  }

  async revokeEntitlement(
    workspaceId: string,
    subscriptionId: string,
    featureKey: string,
  ): Promise<void> {
    // Get customerId before deleting for cache invalidation
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { workspaceId, subscriptionId, featureKey },
      select: { customerId: true },
    });

    await this.prisma.entitlement.deleteMany({
      where: {
        workspaceId,
        subscriptionId,
        featureKey,
      },
    });

    // Invalidate cache after revocation
    if (entitlement) {
      this.invalidateCustomerCache(workspaceId, entitlement.customerId);
    }
  }

  async revokeAllForSubscription(
    workspaceId: string,
    subscriptionId: string,
  ): Promise<void> {
    // Get customerId before deleting for cache invalidation
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { workspaceId, subscriptionId },
      select: { customerId: true },
    });

    await this.prisma.entitlement.deleteMany({
      where: {
        workspaceId,
        subscriptionId,
      },
    });

    // Invalidate cache after revocation
    if (entitlement) {
      this.invalidateCustomerCache(workspaceId, entitlement.customerId);
    }
  }

  async refreshExpirationForSubscription(
    workspaceId: string,
    subscriptionId: string,
    newExpiresAt: Date,
  ): Promise<void> {
    await this.prisma.entitlement.updateMany({
      where: {
        workspaceId,
        subscriptionId,
      },
      data: {
        expiresAt: newExpiresAt,
      },
    });
  }

  private parseEntitlementValue(
    value: string,
    valueType: EntitlementValueType,
  ): string | number | boolean {
    switch (valueType) {
      case "boolean":
        return value === "true";
      case "number":
        return parseFloat(value);
      case "unlimited":
        return Infinity;
      default:
        return value;
    }
  }
}
