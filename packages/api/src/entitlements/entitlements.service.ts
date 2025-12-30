import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Entitlement, EntitlementValueType } from '@prisma/client';

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

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEntitlement(
    workspaceId: string,
    customerId: string,
    featureKey: string
  ): Promise<EntitlementCheck> {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        workspaceId,
        customerId,
        featureKey,
        subscription: {
          status: { in: ['active', 'trialing'] },
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (!entitlement) {
      return {
        featureKey,
        hasAccess: false,
      };
    }

    return {
      featureKey,
      hasAccess: true,
      value: this.parseEntitlementValue(entitlement.value, entitlement.valueType),
      valueType: entitlement.valueType,
    };
  }

  async checkMultipleEntitlements(
    workspaceId: string,
    customerId: string,
    featureKeys: string[]
  ): Promise<EntitlementCheck[]> {
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        workspaceId,
        customerId,
        featureKey: { in: featureKeys },
        subscription: {
          status: { in: ['active', 'trialing'] },
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    const entitlementMap = new Map(
      entitlements.map((e) => [e.featureKey, e])
    );

    return featureKeys.map((featureKey) => {
      const entitlement = entitlementMap.get(featureKey);
      if (!entitlement) {
        return { featureKey, hasAccess: false };
      }
      return {
        featureKey,
        hasAccess: true,
        value: this.parseEntitlementValue(entitlement.value, entitlement.valueType),
        valueType: entitlement.valueType,
      };
    });
  }

  async getCustomerEntitlements(
    workspaceId: string,
    customerId: string
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
        status: { in: ['active', 'trialing'] },
      },
      select: { id: true },
    });

    // Get all entitlements
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        workspaceId,
        customerId,
        subscription: {
          status: { in: ['active', 'trialing'] },
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
    expiresAt?: Date
  ): Promise<Entitlement> {
    return this.prisma.entitlement.upsert({
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
  }

  async revokeEntitlement(
    workspaceId: string,
    subscriptionId: string,
    featureKey: string
  ): Promise<void> {
    await this.prisma.entitlement.deleteMany({
      where: {
        workspaceId,
        subscriptionId,
        featureKey,
      },
    });
  }

  async revokeAllForSubscription(
    workspaceId: string,
    subscriptionId: string
  ): Promise<void> {
    await this.prisma.entitlement.deleteMany({
      where: {
        workspaceId,
        subscriptionId,
      },
    });
  }

  async refreshExpirationForSubscription(
    workspaceId: string,
    subscriptionId: string,
    newExpiresAt: Date
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
    valueType: EntitlementValueType
  ): string | number | boolean {
    switch (valueType) {
      case 'boolean':
        return value === 'true';
      case 'number':
        return parseFloat(value);
      case 'unlimited':
        return Infinity;
      default:
        return value;
    }
  }
}
