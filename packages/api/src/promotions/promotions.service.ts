import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import type {
  Promotion,
  PromotionVersion,
  PromotionStatus,
  Prisma,
} from "@prisma/client";
import type { PaginatedResult } from "@zentla/database";
import type { PromotionConfig, PromotionValidationResult } from "@zentla/core";

export interface PromotionWithVersions extends Promotion {
  versions: PromotionVersion[];
  currentVersion: PromotionVersion | null;
}

export interface CreatePromotionDto {
  code: string;
  name: string;
  description?: string;
  config: PromotionConfig;
}

export interface PromotionQueryParams {
  limit: number;
  cursor?: string;
  status?: PromotionStatus;
  search?: string;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
  ) {}

  async findById(
    workspaceId: string,
    id: string,
  ): Promise<PromotionWithVersions | null> {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
        currentVersion: true,
      },
    });

    return promotion;
  }

  async findByCode(
    workspaceId: string,
    code: string,
  ): Promise<PromotionWithVersions | null> {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        code: code.toUpperCase(),
        workspaceId,
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
        currentVersion: true,
      },
    });

    return promotion;
  }

  async findMany(
    workspaceId: string,
    params: PromotionQueryParams,
  ): Promise<PaginatedResult<Promotion>> {
    const { limit, cursor, status, search } = params;

    const where: Prisma.PromotionWhereInput = {
      workspaceId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const promotions = await this.prisma.promotion.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: "desc" },
      include: {
        currentVersion: true,
      },
    });

    const hasMore = promotions.length > limit;
    const data = hasMore ? promotions.slice(0, -1) : promotions;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async create(
    workspaceId: string,
    dto: CreatePromotionDto,
  ): Promise<PromotionWithVersions> {
    const normalizedCode = dto.code.toUpperCase();

    // Check for duplicate code
    const existing = await this.prisma.promotion.findFirst({
      where: { workspaceId, code: normalizedCode },
    });

    if (existing) {
      throw new BadRequestException(
        `Promotion with code "${normalizedCode}" already exists`,
      );
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Create promotion with draft status (becomes active when first version is published)
      const promotion = await tx.promotion.create({
        data: {
          workspaceId,
          code: normalizedCode,
          name: dto.name,
          description: dto.description,
          status: "draft",
        },
      });

      // Create initial draft version
      const version = await tx.promotionVersion.create({
        data: {
          promotionId: promotion.id,
          version: 1,
          status: "draft",
          config: JSON.parse(JSON.stringify(dto.config)),
        },
      });

      return {
        ...promotion,
        versions: [version],
        currentVersion: null,
      };
    });
  }

  async update(
    workspaceId: string,
    id: string,
    dto: Partial<Pick<Promotion, "name" | "description">>,
  ): Promise<Promotion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, workspaceId },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }

    return this.prisma.promotion.update({
      where: { id },
      data: dto,
    });
  }

  async archive(workspaceId: string, id: string): Promise<Promotion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, workspaceId },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }

    return this.prisma.promotion.update({
      where: { id },
      data: { status: "archived" },
    });
  }

  async createVersion(
    workspaceId: string,
    promotionId: string,
    config: PromotionConfig,
  ): Promise<PromotionVersion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id: promotionId, workspaceId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${promotionId} not found`);
    }

    // Check if there's already a draft version
    const existingDraft = await this.prisma.promotionVersion.findFirst({
      where: {
        promotionId,
        status: "draft",
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        "A draft version already exists. Publish or delete it before creating a new version.",
      );
    }

    const nextVersion = (promotion.versions[0]?.version ?? 0) + 1;

    return this.prisma.promotionVersion.create({
      data: {
        promotionId,
        version: nextVersion,
        status: "draft",
        config: JSON.parse(JSON.stringify(config)),
      },
    });
  }

  async publishVersion(
    workspaceId: string,
    promotionId: string,
    versionId?: string,
  ): Promise<PromotionVersion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id: promotionId, workspaceId },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${promotionId} not found`);
    }

    // Find the version to publish BEFORE starting transaction
    let versionToPublish: PromotionVersion | null;

    if (versionId) {
      versionToPublish = await this.prisma.promotionVersion.findFirst({
        where: { id: versionId, promotionId },
      });
    } else {
      // Find the latest draft
      versionToPublish = await this.prisma.promotionVersion.findFirst({
        where: { promotionId, status: "draft" },
        orderBy: { version: "desc" },
      });
    }

    if (!versionToPublish) {
      throw new NotFoundException("No draft version found to publish");
    }

    if (versionToPublish.status !== "draft") {
      throw new BadRequestException("Only draft versions can be published");
    }

    // Validate config BEFORE any changes
    const config = versionToPublish.config as Record<string, unknown>;
    if (!config?.discountType) {
      throw new BadRequestException(
        "Cannot publish: Promotion has no discount type configured.",
      );
    }

    if (config.discountValue === undefined || config.discountValue === null) {
      throw new BadRequestException(
        "Cannot publish: Promotion has no discount value configured.",
      );
    }

    // Validate billing provider is configured
    const provider: ProviderType = "stripe";
    if (!this.billingService.isConfigured(provider)) {
      throw new BadRequestException(
        `Cannot publish: ${provider} is not configured. Check your billing settings.`,
      );
    }

    // Store previous state for potential rollback
    const previousVersionId = promotion.currentVersionId;
    const previousPromotionStatus = promotion.status;

    const publishedVersion = await this.prisma.executeInTransaction(
      async (tx) => {
        // Archive currently published version
        if (promotion.currentVersionId) {
          await tx.promotionVersion.update({
            where: { id: promotion.currentVersionId },
            data: { status: "archived" },
          });
        }

        // Publish the new version
        const published = await tx.promotionVersion.update({
          where: { id: versionToPublish!.id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });

        // Update promotion's current version and activate if first publish
        await tx.promotion.update({
          where: { id: promotionId },
          data: {
            currentVersionId: published.id,
            // Activate promotion when first version is published
            status: "active",
          },
        });

        return published;
      },
    );

    // Sync to billing provider - if this fails, rollback database changes
    try {
      await this.syncToProvider(
        workspaceId,
        promotion,
        publishedVersion,
        provider,
      );
    } catch (error) {
      this.logger.error(
        `Provider sync failed, rolling back publish for promotion ${promotionId}:`,
        error,
      );

      // Rollback: revert the database changes
      await this.prisma.executeInTransaction(async (tx) => {
        // Revert version status back to draft
        await tx.promotionVersion.update({
          where: { id: publishedVersion.id },
          data: {
            status: "draft",
            publishedAt: null,
          },
        });

        // If we archived a previous version, restore it
        if (previousVersionId) {
          await tx.promotionVersion.update({
            where: { id: previousVersionId },
            data: { status: "published" },
          });
        }

        // Restore promotion to previous state
        await tx.promotion.update({
          where: { id: promotionId },
          data: {
            currentVersionId: previousVersionId,
            status: previousPromotionStatus,
          },
        });
      });

      // Re-throw with a clear message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new BadRequestException(
        `Failed to sync to billing provider: ${errorMessage}. Changes have been rolled back.`,
      );
    }

    return publishedVersion;
  }

  private async syncToProvider(
    workspaceId: string,
    promotion: Promotion,
    version: PromotionVersion,
    provider: ProviderType = "stripe",
  ): Promise<void> {
    // Get workspace settings for billing provider
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

    if (
      !this.billingService.isConfiguredForWorkspace(
        workspaceId,
        provider,
        workspaceSettings,
      )
    ) {
      this.logger.warn(`${provider} not configured, skipping promotion sync`);
      return;
    }

    try {
      const billingProvider = this.billingService.getProviderForWorkspace(
        workspaceId,
        provider,
        workspaceSettings,
      );

      if (!billingProvider.syncPromotion) {
        this.logger.warn(`${provider} adapter does not support syncPromotion`);
        return;
      }

      // Check if we have an existing coupon ref
      const existingCouponRef = await this.providerRefService.findByEntity(
        workspaceId,
        "coupon",
        promotion.id,
        provider,
      );

      // Sync to billing provider
      const result = await billingProvider.syncPromotion(
        {
          id: promotion.id,
          workspaceId: promotion.workspaceId,
          code: promotion.code,
          name: promotion.name,
          description: promotion.description ?? undefined,
          status: promotion.status,
          currentVersionId: promotion.currentVersionId ?? undefined,
          createdAt: promotion.createdAt,
          updatedAt: promotion.updatedAt,
        },
        {
          id: version.id,
          promotionId: version.promotionId,
          version: version.version,
          status: version.status,
          config: version.config as unknown as PromotionConfig,
          publishedAt: version.publishedAt ?? undefined,
          createdAt: version.createdAt,
        },
        existingCouponRef as never,
      );

      // Store coupon ref if new
      if (!existingCouponRef) {
        await this.providerRefService.create({
          workspaceId,
          entityType: "coupon",
          entityId: promotion.id,
          provider,
          externalId: result.couponRef.externalId,
        });
      }

      // Store promotion code ref for this version
      await this.providerRefService.create({
        workspaceId,
        entityType: "promotion_code",
        entityId: version.id,
        provider,
        externalId: result.promotionCodeRef.externalId,
      });

      this.logger.log(
        `Synced promotion ${promotion.id} version ${version.id} to ${provider}: coupon=${result.couponRef.externalId}, promo_code=${result.promotionCodeRef.externalId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to sync promotion to ${provider}: ${error}`);
      // Don't throw - promotion is published in our DB even if provider sync fails
    }
  }

  async getVersions(
    workspaceId: string,
    promotionId: string,
  ): Promise<PromotionVersion[]> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id: promotionId, workspaceId },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion ${promotionId} not found`);
    }

    return this.prisma.promotionVersion.findMany({
      where: { promotionId },
      orderBy: { version: "desc" },
    });
  }

  async validate(
    workspaceId: string,
    code: string,
    offerId: string,
    customerId?: string,
    orderAmount?: number,
  ): Promise<PromotionValidationResult> {
    const promotion = await this.findByCode(workspaceId, code);

    if (!promotion) {
      return {
        isValid: false,
        errorCode: "not_found",
        errorMessage: "Promotion code not found",
      };
    }

    if (promotion.status === "archived") {
      return {
        isValid: false,
        errorCode: "not_found",
        errorMessage: "Promotion is no longer available",
      };
    }

    if (promotion.status === "draft") {
      return {
        isValid: false,
        errorCode: "not_published",
        errorMessage: "Promotion is not yet active",
      };
    }

    if (!promotion.currentVersion) {
      return {
        isValid: false,
        errorCode: "not_published",
        errorMessage: "Promotion is not yet active",
      };
    }

    const config = promotion.currentVersion
      .config as unknown as PromotionConfig;
    const now = new Date();

    // Check validity dates
    if (config.validFrom && new Date(config.validFrom) > now) {
      return {
        isValid: false,
        errorCode: "not_yet_valid",
        errorMessage: "Promotion is not yet valid",
      };
    }

    if (config.validUntil && new Date(config.validUntil) < now) {
      return {
        isValid: false,
        errorCode: "expired",
        errorMessage: "Promotion has expired",
      };
    }

    // Check applicable offers
    if (config.applicableOfferIds && config.applicableOfferIds.length > 0) {
      if (!config.applicableOfferIds.includes(offerId)) {
        return {
          isValid: false,
          errorCode: "offer_not_applicable",
          errorMessage: "Promotion does not apply to this offer",
        };
      }
    }

    // Check minimum amount
    if (
      config.minimumAmount &&
      orderAmount !== undefined &&
      orderAmount < config.minimumAmount
    ) {
      return {
        isValid: false,
        errorCode: "minimum_not_met",
        errorMessage: `Minimum order of ${config.minimumAmount / 100} ${config.currency || "USD"} required`,
      };
    }

    // Check max redemptions
    if (config.maxRedemptions) {
      const totalRedemptions = await this.prisma.appliedPromotion.count({
        where: { promotionId: promotion.id },
      });

      if (totalRedemptions >= config.maxRedemptions) {
        return {
          isValid: false,
          errorCode: "max_redemptions_reached",
          errorMessage: "Promotion has reached its maximum redemptions",
        };
      }
    }

    // Check per-customer limits
    if (customerId && config.maxRedemptionsPerCustomer) {
      const customerRedemptions = await this.prisma.appliedPromotion.count({
        where: {
          promotionId: promotion.id,
          customerId,
        },
      });

      if (customerRedemptions >= config.maxRedemptionsPerCustomer) {
        return {
          isValid: false,
          errorCode: "customer_limit_reached",
          errorMessage: "You have already used this promotion",
        };
      }
    }

    return {
      isValid: true,
      promotion: {
        id: promotion.id,
        workspaceId: promotion.workspaceId,
        code: promotion.code,
        name: promotion.name,
        description: promotion.description ?? undefined,
        status: promotion.status,
        currentVersionId: promotion.currentVersionId ?? undefined,
        createdAt: promotion.createdAt,
        updatedAt: promotion.updatedAt,
      },
      promotionVersion: {
        id: promotion.currentVersion.id,
        promotionId: promotion.currentVersion.promotionId,
        version: promotion.currentVersion.version,
        status: promotion.currentVersion.status,
        config,
        publishedAt: promotion.currentVersion.publishedAt ?? undefined,
        createdAt: promotion.currentVersion.createdAt,
      },
    };
  }

  async recordAppliedPromotion(params: {
    workspaceId: string;
    promotionId: string;
    promotionVersionId: string;
    customerId: string;
    discountAmount: number;
    checkoutId?: string;
    subscriptionId?: string;
  }): Promise<void> {
    await this.prisma.appliedPromotion.create({
      data: {
        workspaceId: params.workspaceId,
        promotionId: params.promotionId,
        promotionVersionId: params.promotionVersionId,
        customerId: params.customerId,
        discountAmount: params.discountAmount,
        checkoutId: params.checkoutId,
        subscriptionId: params.subscriptionId,
      },
    });
  }

  async getAppliedPromotions(
    workspaceId: string,
    promotionId: string,
  ): Promise<{ count: number; totalDiscount: number }> {
    const [count, aggregate] = await Promise.all([
      this.prisma.appliedPromotion.count({
        where: { workspaceId, promotionId },
      }),
      this.prisma.appliedPromotion.aggregate({
        where: { workspaceId, promotionId },
        _sum: { discountAmount: true },
      }),
    ]);

    return {
      count,
      totalDiscount: aggregate._sum.discountAmount ?? 0,
    };
  }
}
