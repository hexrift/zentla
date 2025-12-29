import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ProviderRefService } from '../billing/provider-ref.service';
import type { Checkout, Prisma } from '@prisma/client';

export interface CreateCheckoutDto {
  offerId: string;
  offerVersionId?: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
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
  ) {}

  async findById(workspaceId: string, id: string): Promise<Checkout | null> {
    return this.prisma.checkout.findFirst({
      where: { id, workspaceId },
    });
  }

  async create(workspaceId: string, dto: CreateCheckoutDto): Promise<CheckoutSessionResult> {
    // Validate offer exists and get published version
    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, workspaceId, status: 'active' },
      include: { currentVersion: true },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${dto.offerId} not found or not active`);
    }

    const offerVersionId = dto.offerVersionId ?? offer.currentVersionId;
    if (!offerVersionId) {
      throw new BadRequestException('Offer has no published version');
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
    if (trialDays === undefined && offer.currentVersion) {
      const config = offer.currentVersion.config as { trial?: { days?: number } };
      trialDays = config?.trial?.days;
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
      allowPromotionCodes: dto.allowPromotionCodes,
      trialDays,
      metadata: {
        checkoutId: checkout.id,
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
