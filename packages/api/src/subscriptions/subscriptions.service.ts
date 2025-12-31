import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OffersService } from "../offers/offers.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import type { Subscription, SubscriptionStatus, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@relay/database";

export interface SubscriptionWithRelations extends Subscription {
  customer: {
    id: string;
    email: string;
    name: string | null;
  };
  offer: {
    id: string;
    name: string;
  };
  offerVersion: {
    id: string;
    version: number;
    config: unknown;
  };
}

export interface SubscriptionQueryParams {
  limit: number;
  cursor?: string;
  customerId?: string;
  offerId?: string;
  status?: SubscriptionStatus;
  statuses?: SubscriptionStatus[];
}

export interface CancelSubscriptionDto {
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface ChangeSubscriptionDto {
  newOfferId: string;
  newOfferVersionId?: string;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
    private readonly offersService: OffersService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async findById(
    workspaceId: string,
    id: string,
  ): Promise<SubscriptionWithRelations | null> {
    return this.prisma.subscription.findFirst({
      where: { id, workspaceId },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
        offerVersion: {
          select: { id: true, version: true, config: true },
        },
      },
    });
  }

  async findByCustomerId(
    workspaceId: string,
    customerId: string,
  ): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { workspaceId, customerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findMany(
    workspaceId: string,
    params: SubscriptionQueryParams,
  ): Promise<PaginatedResult<Subscription>> {
    const { limit, cursor, customerId, offerId, status, statuses } = params;

    const where: Prisma.SubscriptionWhereInput = {
      workspaceId,
      ...(customerId && { customerId }),
      ...(offerId && { offerId }),
      ...(status && { status }),
      ...(statuses && { status: { in: statuses } }),
    };

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
      },
    });

    const hasMore = subscriptions.length > limit;
    const data = hasMore ? subscriptions.slice(0, -1) : subscriptions;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async cancel(
    workspaceId: string,
    id: string,
    dto: CancelSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    const now = new Date();

    if (dto.cancelAtPeriodEnd) {
      // Schedule cancellation at period end - entitlements remain until then
      return this.prisma.subscription.update({
        where: { id },
        data: {
          cancelAt: subscription.currentPeriodEnd,
          metadata: {
            ...(subscription.metadata as Record<string, unknown>),
            cancelReason: dto.reason,
          },
          version: { increment: 1 },
        },
      });
    }

    // Immediate cancellation - revoke entitlements now
    const canceledSubscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "canceled",
        canceledAt: now,
        endedAt: now,
        metadata: {
          ...(subscription.metadata as Record<string, unknown>),
          cancelReason: dto.reason,
        },
        version: { increment: 1 },
      },
    });

    // Revoke all entitlements for immediate cancellation
    await this.entitlementsService.revokeAllForSubscription(workspaceId, id);
    this.logger.log(`Revoked entitlements for canceled subscription ${id}`);

    return canceledSubscription;
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: SubscriptionStatus,
  ): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return this.prisma.subscription.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });
  }

  async getActiveSubscriptionsForCustomer(
    workspaceId: string,
    customerId: string,
  ): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: {
        workspaceId,
        customerId,
        status: { in: ["active", "trialing"] },
      },
      include: {
        offer: true,
        offerVersion: true,
      },
    });
  }

  async change(
    workspaceId: string,
    id: string,
    dto: ChangeSubscriptionDto,
  ): Promise<Subscription> {
    // 1. Verify subscription exists and is changeable
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, workspaceId },
      include: {
        offer: true,
        offerVersion: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    if (!["active", "trialing"].includes(subscription.status)) {
      throw new BadRequestException(
        `Cannot change subscription in '${subscription.status}' status. Only active or trialing subscriptions can be changed.`,
      );
    }

    // 2. Validate the new offer exists and has a published version
    const newOffer = await this.offersService.findById(
      workspaceId,
      dto.newOfferId,
    );
    if (!newOffer) {
      throw new NotFoundException(`Offer ${dto.newOfferId} not found`);
    }

    // Get the target version (either specified or the current published version)
    const newVersion = dto.newOfferVersionId
      ? await this.offersService.getVersion(workspaceId, dto.newOfferVersionId)
      : await this.offersService.getPublishedVersion(
          workspaceId,
          dto.newOfferId,
        );

    if (!newVersion) {
      throw new BadRequestException(
        dto.newOfferVersionId
          ? `Version ${dto.newOfferVersionId} not found`
          : `Offer ${dto.newOfferId} has no published version`,
      );
    }

    if (newVersion.status !== "published") {
      throw new BadRequestException(
        `Cannot change to version ${newVersion.id} - only published versions can be used`,
      );
    }

    // 3. Check if Stripe is configured
    if (!this.billingService.isConfigured("stripe")) {
      throw new BadRequestException(
        "Stripe billing provider is not configured",
      );
    }

    // 4. Get the Stripe subscription ID
    const stripeSubscriptionRef = await this.providerRefService.findByEntity(
      workspaceId,
      "subscription",
      id,
      "stripe",
    );

    if (!stripeSubscriptionRef) {
      throw new BadRequestException(
        `Subscription ${id} is not linked to Stripe. Cannot change plan.`,
      );
    }

    // 5. Get the new Stripe price ID
    const newStripePriceId = await this.providerRefService.getStripePriceId(
      workspaceId,
      newVersion.id,
    );

    if (!newStripePriceId) {
      throw new BadRequestException(
        `Offer version ${newVersion.id} is not synced to Stripe. Please sync the offer first.`,
      );
    }

    // 6. Change the subscription in Stripe
    const stripeAdapter = this.billingService.getStripeAdapter();
    const result = await stripeAdapter.changeSubscription(
      {
        ...stripeSubscriptionRef,
        metadata: stripeSubscriptionRef.metadata as
          | Record<string, unknown>
          | undefined,
      },
      {
        newOfferId: dto.newOfferId,
        newOfferVersionId: newStripePriceId, // Pass the Stripe price ID
        prorationBehavior: dto.prorationBehavior,
      },
    );

    this.logger.log(
      `Changed subscription ${id} from offer ${subscription.offerId} to ${dto.newOfferId} (Stripe: ${stripeSubscriptionRef.externalId})`,
    );

    // 7. Update the local subscription record
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        offerId: dto.newOfferId,
        offerVersionId: newVersion.id,
        metadata: {
          ...(subscription.metadata as Record<string, unknown>),
          previousOfferId: subscription.offerId,
          previousOfferVersionId: subscription.offerVersionId,
          changedAt: new Date().toISOString(),
          prorationBehavior: dto.prorationBehavior ?? "create_prorations",
        },
        version: { increment: 1 },
      },
    });

    this.logger.log(
      `Subscription ${id} plan changed. Effective date: ${result.effectiveDate.toISOString()}`,
    );

    return updatedSubscription;
  }
}
