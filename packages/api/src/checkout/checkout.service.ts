import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ProviderRefService } from '../billing/provider-ref.service';
import { OffersService } from '../offers/offers.service';
import type { Checkout, Prisma } from '@prisma/client';

export interface CreateCheckoutDto {
  offerId: string;
  offerVersionId?: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  promotionCode?: string; // Pre-validated Relay promotion code
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  expiresAt: Date;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
    @Inject(forwardRef(() => OffersService))
    private readonly offersService: OffersService,
  ) {}

  async findById(workspaceId: string, id: string): Promise<Checkout | null> {
    return this.prisma.checkout.findFirst({
      where: { id, workspaceId },
    });
  }

  async create(workspaceId: string, dto: CreateCheckoutDto): Promise<CheckoutSessionResult> {
    // Validate offer exists
    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, workspaceId, status: 'active' },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${dto.offerId} not found or not active`);
    }

    // Get the offer version to use
    // If a specific version is provided, use that
    // Otherwise, get the currently effective version (time-aware for scheduled versions)
    let offerVersionId: string;
    let effectiveVersion;

    if (dto.offerVersionId) {
      offerVersionId = dto.offerVersionId;
      effectiveVersion = await this.offersService.getVersion(workspaceId, dto.offerVersionId);
    } else {
      effectiveVersion = await this.offersService.getEffectiveVersion(workspaceId, dto.offerId);
      if (!effectiveVersion) {
        throw new BadRequestException('Offer has no effective published version');
      }
      offerVersionId = effectiveVersion.id;
    }

    // Get the Stripe price ID for this offer version
    const stripePriceId = await this.providerRefService.getStripePriceId(
      workspaceId,
      offerVersionId
    );

    if (!stripePriceId) {
      throw new BadRequestException(
        'Offer not synced to Stripe. Please publish the offer first.'
      );
    }

    // Get Stripe customer ID if customer provided
    let stripeCustomerId: string | undefined;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, workspaceId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
      stripeCustomerId = await this.providerRefService.getStripeCustomerId(
        workspaceId,
        dto.customerId
      ) ?? undefined;
    }

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create checkout record in our database first
    const checkout = await this.prisma.checkout.create({
      data: {
        workspaceId,
        offerId: dto.offerId,
        offerVersionId,
        customerId: dto.customerId,
        customerEmail: dto.customerEmail,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        status: 'pending',
        expiresAt,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Get trial days from offer config if not overridden
    let trialDays = dto.trialDays;
    if (trialDays === undefined && effectiveVersion) {
      const config = effectiveVersion.config as { trial?: { days?: number } };
      trialDays = config?.trial?.days;
    }

    // Validate and get Stripe promotion code ID if provided
    let stripePromotionCodeId: string | undefined;
    let promotionId: string | undefined;
    let promotionVersionId: string | undefined;

    if (dto.promotionCode) {
      // Look up the Relay promotion by code
      const promotion = await this.prisma.promotion.findFirst({
        where: {
          workspaceId,
          code: dto.promotionCode.toUpperCase(),
          status: 'active',
        },
        include: { currentVersion: true },
      });

      if (!promotion) {
        throw new BadRequestException(`Promotion code "${dto.promotionCode}" not found`);
      }

      if (!promotion.currentVersion) {
        throw new BadRequestException('Promotion is not published');
      }

      promotionId = promotion.id;
      promotionVersionId = promotion.currentVersion.id;

      // Get the Stripe promotion code ID
      const promoCodeRef = await this.providerRefService.findByEntity(
        workspaceId,
        'promotion_code',
        promotion.currentVersion.id,
        'stripe'
      );

      if (promoCodeRef) {
        stripePromotionCodeId = promoCodeRef.externalId;
      } else {
        this.logger.warn(
          `Promotion ${promotion.id} not synced to Stripe, falling back to allow_promotion_codes`
        );
      }
    }

    // Create Stripe Checkout Session
    if (!this.billingService.isConfigured('stripe')) {
      throw new BadRequestException('Stripe not configured');
    }

    const stripeAdapter = this.billingService.getStripeAdapter();

    const stripeSession = await stripeAdapter.createCheckoutSession({
      workspaceId,
      offerId: dto.offerId,
      offerVersionId: stripePriceId, // This is the Stripe Price ID
      customerId: stripeCustomerId,
      customerEmail: dto.customerEmail,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      allowPromotionCodes: dto.allowPromotionCodes && !stripePromotionCodeId,
      promotionCodeId: stripePromotionCodeId,
      trialDays,
      metadata: {
        checkoutId: checkout.id,
        promotionId,
        promotionVersionId,
        ...dto.metadata,
      },
    });

    // Update checkout with session URL
    await this.prisma.checkout.update({
      where: { id: checkout.id },
      data: {
        sessionUrl: stripeSession.url,
        status: 'open',
      },
    });

    // Store provider ref for checkout session
    await this.providerRefService.create({
      workspaceId,
      entityType: 'checkout',
      entityId: checkout.id,
      provider: 'stripe',
      externalId: stripeSession.id,
    });

    this.logger.log(`Created checkout session ${checkout.id} with Stripe session ${stripeSession.id}`);

    return {
      id: checkout.id,
      url: stripeSession.url,
      expiresAt: stripeSession.expiresAt,
    };
  }

  async updateWithSession(
    workspaceId: string,
    id: string,
    sessionUrl: string
  ): Promise<Checkout> {
    const checkout = await this.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout ${id} not found`);
    }

    return this.prisma.checkout.update({
      where: { id },
      data: {
        sessionUrl,
        status: 'open',
      },
    });
  }

  async complete(workspaceId: string, id: string): Promise<Checkout> {
    const checkout = await this.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout ${id} not found`);
    }

    return this.prisma.checkout.update({
      where: { id },
      data: {
        status: 'complete',
        completedAt: new Date(),
      },
    });
  }

  async expire(workspaceId: string, id: string): Promise<Checkout> {
    const checkout = await this.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout ${id} not found`);
    }

    return this.prisma.checkout.update({
      where: { id },
      data: {
        status: 'expired',
      },
    });
  }

  async expireOldCheckouts(): Promise<number> {
    const result = await this.prisma.checkout.updateMany({
      where: {
        status: { in: ['pending', 'open'] },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }
}
