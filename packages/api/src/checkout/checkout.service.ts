import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import type { StripeAdapter } from "@zentla/stripe-adapter";
import { ProviderRefService } from "../billing/provider-ref.service";
import { OffersService } from "../offers/offers.service";
import type { Checkout, CheckoutIntent, Prisma } from "@prisma/client";

export interface CreateCheckoutDto {
  offerId: string;
  offerVersionId?: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  promotionCode?: string; // Pre-validated Zentla promotion code
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  expiresAt: Date;
}

export interface CreateQuoteDto {
  offerId: string;
  offerVersionId?: string;
  promotionCode?: string;
  customerId?: string;
}

export interface QuoteResult {
  offerId: string;
  offerVersionId: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  interval: string | null;
  intervalCount: number;
  trial: {
    days: number;
    requiresPaymentMethod: boolean;
  } | null;
  promotion: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    duration: string;
    durationInMonths: number | null;
  } | null;
  validationErrors: string[];
}

export interface CreateIntentDto {
  offerId: string;
  offerVersionId?: string;
  customerId?: string;
  customerEmail?: string;
  promotionCode?: string;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface IntentResult {
  id: string;
  status: string;
  clientSecret: string | null;
  offerId: string;
  offerVersionId: string;
  customerId: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  trialDays: number | null;
  promotionCode: string | null;
  subscriptionId: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
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

  async listSessions(
    workspaceId: string,
    params: {
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const { status, limit = 50, cursor } = params;
    const take = Math.min(limit, 100);

    const sessions = await this.prisma.checkout.findMany({
      where: {
        workspaceId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(status && { status: status as any }),
      },
      include: {
        offer: { select: { id: true, name: true } },
        customer: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = sessions.length > take;
    const data = hasMore ? sessions.slice(0, take) : sessions;

    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    };
  }

  async listIntents(
    workspaceId: string,
    params: {
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const { status, limit = 50, cursor } = params;
    const take = Math.min(limit, 100);

    const intents = await this.prisma.checkoutIntent.findMany({
      where: {
        workspaceId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(status && { status: status as any }),
      },
      include: {
        offer: { select: { id: true, name: true } },
        customer: { select: { id: true, email: true, name: true } },
        subscription: { select: { id: true, status: true } },
        promotion: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = intents.length > take;
    const data = hasMore ? intents.slice(0, take) : intents;

    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    };
  }

  async getCheckoutStats(workspaceId: string) {
    const [sessions, intents] = await Promise.all([
      this.prisma.checkout.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: { id: true },
      }),
      this.prisma.checkoutIntent.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: { id: true },
      }),
    ]);

    const sessionStats = sessions.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const intentStats = intents.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalSessions = Object.values(sessionStats).reduce(
      (a, b) => a + b,
      0,
    );
    const totalIntents = Object.values(intentStats).reduce((a, b) => a + b, 0);
    const completedSessions = sessionStats["complete"] || 0;
    const succeededIntents = intentStats["succeeded"] || 0;

    return {
      sessions: {
        total: totalSessions,
        pending: sessionStats["pending"] || 0,
        completed: completedSessions,
        expired: sessionStats["expired"] || 0,
        conversionRate:
          totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
      },
      intents: {
        total: totalIntents,
        pending: intentStats["pending"] || 0,
        processing: intentStats["processing"] || 0,
        requiresAction: intentStats["requires_action"] || 0,
        succeeded: succeededIntents,
        failed: intentStats["failed"] || 0,
        expired: intentStats["expired"] || 0,
        conversionRate:
          totalIntents > 0 ? (succeededIntents / totalIntents) * 100 : 0,
      },
    };
  }

  async create(
    workspaceId: string,
    dto: CreateCheckoutDto,
  ): Promise<CheckoutSessionResult> {
    // Validate offer exists
    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, workspaceId, status: "active" },
    });

    if (!offer) {
      throw new NotFoundException(
        `Offer ${dto.offerId} not found or not active`,
      );
    }

    // Get the offer version to use
    // If a specific version is provided, use that
    // Otherwise, get the currently effective version (time-aware for scheduled versions)
    let offerVersionId: string;
    let effectiveVersion;

    if (dto.offerVersionId) {
      offerVersionId = dto.offerVersionId;
      effectiveVersion = await this.offersService.getVersion(
        workspaceId,
        dto.offerVersionId,
      );
    } else {
      effectiveVersion = await this.offersService.getEffectiveVersion(
        workspaceId,
        dto.offerId,
      );
      if (!effectiveVersion) {
        throw new BadRequestException(
          "Offer has no effective published version",
        );
      }
      offerVersionId = effectiveVersion.id;
    }

    // Get the provider price ID for this offer version
    const provider: ProviderType = "stripe";
    const providerPriceId = await this.providerRefService.getProviderPriceId(
      workspaceId,
      offerVersionId,
      provider,
    );

    if (!providerPriceId) {
      throw new BadRequestException(
        `Offer not synced to ${provider}. Please publish the offer first.`,
      );
    }

    // Get provider customer ID if customer provided
    let providerCustomerId: string | undefined;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, workspaceId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
      providerCustomerId =
        (await this.providerRefService.getProviderCustomerId(
          workspaceId,
          dto.customerId,
          provider,
        )) ?? undefined;
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
        status: "pending",
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
      // Look up the Zentla promotion by code
      const promotion = await this.prisma.promotion.findFirst({
        where: {
          workspaceId,
          code: dto.promotionCode.toUpperCase(),
          status: "active",
        },
        include: { currentVersion: true },
      });

      if (!promotion) {
        throw new BadRequestException(
          `Promotion code "${dto.promotionCode}" not found`,
        );
      }

      if (!promotion.currentVersion) {
        throw new BadRequestException("Promotion is not published");
      }

      promotionId = promotion.id;
      promotionVersionId = promotion.currentVersion.id;

      // Get the Stripe promotion code ID
      const promoCodeRef = await this.providerRefService.findByEntity(
        workspaceId,
        "promotion_code",
        promotion.currentVersion.id,
        "stripe",
      );

      if (promoCodeRef) {
        stripePromotionCodeId = promoCodeRef.externalId;
      } else {
        this.logger.warn(
          `Promotion ${promotion.id} not synced to Stripe, falling back to allow_promotion_codes`,
        );
      }
    }

    // Get workspace settings to check billing provider configuration
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const workspaceSettings = workspace?.settings as
      | {
          stripeSecretKey?: string;
          stripeWebhookSecret?: string;
          zuoraClientId?: string;
          zuoraClientSecret?: string;
          zuoraBaseUrl?: string;
        }
      | undefined;

    // Create checkout session via billing provider
    if (
      !this.billingService.isConfiguredForWorkspace(
        workspaceId,
        provider,
        workspaceSettings,
      )
    ) {
      throw new BadRequestException(`${provider} not configured`);
    }

    const billingProvider = this.billingService.getProviderForWorkspace(
      workspaceId,
      provider,
      workspaceSettings,
    ) as StripeAdapter;

    // Validate webhook is configured before allowing checkout
    const hasWebhook = await billingProvider.hasWebhookConfigured("webhook");
    if (!hasWebhook) {
      throw new BadRequestException(
        `${provider} webhook not configured. Please configure a webhook endpoint in your billing provider dashboard pointing to your API before creating checkouts.`,
      );
    }

    const providerSession = await billingProvider.createCheckoutSession({
      workspaceId,
      offerId: dto.offerId,
      offerVersionId: providerPriceId, // This is the provider Price ID
      customerId: providerCustomerId,
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
        sessionUrl: providerSession.url,
        status: "open",
      },
    });

    // Store provider ref for checkout session
    await this.providerRefService.create({
      workspaceId,
      entityType: "checkout",
      entityId: checkout.id,
      provider,
      externalId: providerSession.id,
    });

    this.logger.log(
      `Created checkout session ${checkout.id} with ${provider} session ${providerSession.id}`,
    );

    return {
      id: checkout.id,
      url: providerSession.url,
      expiresAt: providerSession.expiresAt,
    };
  }

  async updateWithSession(
    workspaceId: string,
    id: string,
    sessionUrl: string,
  ): Promise<Checkout> {
    const checkout = await this.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout ${id} not found`);
    }

    return this.prisma.checkout.update({
      where: { id },
      data: {
        sessionUrl,
        status: "open",
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
        status: "complete",
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
        status: "expired",
      },
    });
  }

  async expireOldCheckouts(): Promise<number> {
    const result = await this.prisma.checkout.updateMany({
      where: {
        status: { in: ["pending", "open"] },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: "expired",
      },
    });

    return result.count;
  }

  // ==========================================================================
  // HEADLESS CHECKOUT METHODS
  // ==========================================================================

  async createQuote(
    workspaceId: string,
    dto: CreateQuoteDto,
  ): Promise<QuoteResult> {
    // Validate offer exists
    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, workspaceId, status: "active" },
    });

    if (!offer) {
      throw new NotFoundException(
        `Offer ${dto.offerId} not found or not active`,
      );
    }

    // Get the effective offer version
    let effectiveVersion;
    if (dto.offerVersionId) {
      effectiveVersion = await this.offersService.getVersion(
        workspaceId,
        dto.offerVersionId,
      );
    } else {
      effectiveVersion = await this.offersService.getEffectiveVersion(
        workspaceId,
        dto.offerId,
      );
    }

    if (!effectiveVersion) {
      throw new BadRequestException("Offer has no effective published version");
    }

    const config = effectiveVersion.config as {
      pricing: {
        amount: number;
        currency: string;
        interval?: string;
        intervalCount?: number;
      };
      trial?: {
        days: number;
        requirePaymentMethod: boolean;
      };
    };

    const validationErrors: string[] = [];
    let promotionInfo: QuoteResult["promotion"] = null;
    let discountAmount = 0;

    // Validate and calculate promotion discount
    if (dto.promotionCode) {
      const promotion = await this.prisma.promotion.findFirst({
        where: {
          workspaceId,
          code: dto.promotionCode.toUpperCase(),
          status: "active",
        },
        include: { currentVersion: true },
      });

      if (!promotion) {
        validationErrors.push(
          `Promotion code "${dto.promotionCode}" not found`,
        );
      } else if (!promotion.currentVersion) {
        validationErrors.push("Promotion is not published");
      } else {
        const promoConfig = promotion.currentVersion.config as {
          discountType: string;
          discountValue: number;
          duration?: string;
          durationInMonths?: number;
          validFrom?: string;
          validUntil?: string;
          applicableOfferIds?: string[];
        };

        // Check validity dates
        const now = new Date();
        if (promoConfig.validFrom && new Date(promoConfig.validFrom) > now) {
          validationErrors.push("Promotion is not yet active");
        } else if (
          promoConfig.validUntil &&
          new Date(promoConfig.validUntil) < now
        ) {
          validationErrors.push("Promotion has expired");
        } else if (
          promoConfig.applicableOfferIds?.length &&
          !promoConfig.applicableOfferIds.includes(dto.offerId)
        ) {
          validationErrors.push("Promotion is not applicable to this offer");
        } else {
          // Calculate discount
          if (promoConfig.discountType === "percent") {
            discountAmount = Math.floor(
              (config.pricing.amount * promoConfig.discountValue) / 100,
            );
          } else {
            discountAmount = promoConfig.discountValue;
          }

          promotionInfo = {
            id: promotion.id,
            code: promotion.code,
            discountType: promoConfig.discountType,
            discountValue: promoConfig.discountValue,
            duration: promoConfig.duration ?? "once",
            durationInMonths: promoConfig.durationInMonths ?? null,
          };
        }
      }
    }

    const subtotal = config.pricing.amount;
    const total = Math.max(0, subtotal - discountAmount);

    return {
      offerId: dto.offerId,
      offerVersionId: effectiveVersion.id,
      currency: config.pricing.currency,
      subtotal,
      discount: discountAmount,
      tax: 0, // Tax calculation would be handled by provider or separate service
      total,
      interval: config.pricing.interval ?? null,
      intervalCount: config.pricing.intervalCount ?? 1,
      trial: config.trial
        ? {
            days: config.trial.days,
            requiresPaymentMethod: config.trial.requirePaymentMethod,
          }
        : null,
      promotion: promotionInfo,
      validationErrors,
    };
  }

  async createIntent(
    workspaceId: string,
    dto: CreateIntentDto,
    idempotencyKey?: string,
  ): Promise<IntentResult> {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.prisma.checkoutIntent.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        // Return existing intent if same workspace
        if (existing.workspaceId === workspaceId) {
          return this.formatIntentResult(existing);
        }
        throw new ConflictException("Idempotency key already used");
      }
    }

    // Get quote to lock in pricing
    const quote = await this.createQuote(workspaceId, {
      offerId: dto.offerId,
      offerVersionId: dto.offerVersionId,
      promotionCode: dto.promotionCode,
      customerId: dto.customerId,
    });

    if (quote.validationErrors.length > 0) {
      throw new BadRequestException(quote.validationErrors.join("; "));
    }

    // Validate customer if provided
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, workspaceId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
    }

    // Get trial days
    const trialDays = dto.trialDays ?? quote.trial?.days ?? null;

    // Set expiration to 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Get promotion IDs if code was applied
    let promotionId: string | undefined;
    let promotionVersionId: string | undefined;
    if (dto.promotionCode && quote.promotion) {
      promotionId = quote.promotion.id;
      const promo = await this.prisma.promotion.findUnique({
        where: { id: promotionId },
        select: { currentVersionId: true },
      });
      promotionVersionId = promo?.currentVersionId ?? undefined;
    }

    // Create the checkout intent
    const intent = await this.prisma.checkoutIntent.create({
      data: {
        workspaceId,
        offerId: dto.offerId,
        offerVersionId: quote.offerVersionId,
        customerId: dto.customerId,
        customerEmail: dto.customerEmail,
        status: "pending",
        currency: quote.currency,
        subtotalAmount: quote.subtotal,
        discountAmount: quote.discount,
        taxAmount: quote.tax,
        totalAmount: quote.total,
        trialDays,
        promotionId,
        promotionVersionId,
        promotionCode: dto.promotionCode?.toUpperCase(),
        idempotencyKey,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    // Create billing provider PaymentIntent or SetupIntent
    let clientSecret: string | null = null;
    const intentProvider: ProviderType = "stripe";

    // Get workspace settings for billing provider
    const intentWorkspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const intentWorkspaceSettings = intentWorkspace?.settings as
      | {
          stripeSecretKey?: string;
          stripeWebhookSecret?: string;
          zuoraClientId?: string;
          zuoraClientSecret?: string;
          zuoraBaseUrl?: string;
        }
      | undefined;

    if (
      this.billingService.isConfiguredForWorkspace(
        workspaceId,
        intentProvider,
        intentWorkspaceSettings,
      )
    ) {
      const billingProvider = this.billingService.getProviderForWorkspace(
        workspaceId,
        intentProvider,
        intentWorkspaceSettings,
      ) as StripeAdapter;

      // Get or create provider customer
      let providerCustomerId: string | undefined;
      if (dto.customerId) {
        providerCustomerId =
          (await this.providerRefService.getProviderCustomerId(
            workspaceId,
            dto.customerId,
            intentProvider,
          )) ?? undefined;
      }

      // Determine if we need PaymentIntent or SetupIntent
      const needsImmediatePayment =
        !trialDays || (quote.trial?.requiresPaymentMethod && quote.total > 0);

      if (needsImmediatePayment && quote.total > 0) {
        // Create PaymentIntent for immediate charge
        const paymentIntent = await billingProvider.createPaymentIntent({
          amount: quote.total,
          currency: quote.currency.toLowerCase(),
          customerId: providerCustomerId,
          metadata: {
            checkoutIntentId: intent.id,
            workspaceId,
            offerId: dto.offerId,
            promotionId,
          },
        });

        clientSecret = paymentIntent.clientSecret;

        // Store the PaymentIntent reference
        await this.prisma.checkoutIntent.update({
          where: { id: intent.id },
          data: {
            providerPaymentId: paymentIntent.id,
            clientSecret: paymentIntent.clientSecret,
          },
        });
      } else {
        // Create SetupIntent for future payments (trials)
        const setupIntent = await billingProvider.createSetupIntent({
          customerId: providerCustomerId,
          metadata: {
            checkoutIntentId: intent.id,
            workspaceId,
            offerId: dto.offerId,
          },
        });

        clientSecret = setupIntent.clientSecret;

        await this.prisma.checkoutIntent.update({
          where: { id: intent.id },
          data: {
            providerPaymentId: setupIntent.id,
            clientSecret: setupIntent.clientSecret,
          },
        });
      }
    }

    this.logger.log(`Created checkout intent ${intent.id}`);

    return {
      id: intent.id,
      status: intent.status,
      clientSecret,
      offerId: intent.offerId,
      offerVersionId: intent.offerVersionId,
      customerId: intent.customerId,
      currency: intent.currency,
      subtotal: intent.subtotalAmount,
      discount: intent.discountAmount,
      tax: intent.taxAmount,
      total: intent.totalAmount,
      trialDays: intent.trialDays,
      promotionCode: intent.promotionCode,
      subscriptionId: intent.subscriptionId,
      expiresAt: intent.expiresAt,
      completedAt: intent.completedAt,
      metadata: intent.metadata as Record<string, unknown>,
      createdAt: intent.createdAt,
    };
  }

  async findIntentById(
    workspaceId: string,
    id: string,
  ): Promise<IntentResult | null> {
    const intent = await this.prisma.checkoutIntent.findFirst({
      where: { id, workspaceId },
    });

    if (!intent) {
      return null;
    }

    return this.formatIntentResult(intent);
  }

  private formatIntentResult(intent: CheckoutIntent): IntentResult {
    return {
      id: intent.id,
      status: intent.status,
      clientSecret: intent.clientSecret,
      offerId: intent.offerId,
      offerVersionId: intent.offerVersionId,
      customerId: intent.customerId,
      currency: intent.currency,
      subtotal: intent.subtotalAmount,
      discount: intent.discountAmount,
      tax: intent.taxAmount,
      total: intent.totalAmount,
      trialDays: intent.trialDays,
      promotionCode: intent.promotionCode,
      subscriptionId: intent.subscriptionId,
      expiresAt: intent.expiresAt,
      completedAt: intent.completedAt,
      metadata: intent.metadata as Record<string, unknown>,
      createdAt: intent.createdAt,
    };
  }
}
