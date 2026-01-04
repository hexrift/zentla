import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService, ProviderType } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";
import type { Offer, OfferVersion, OfferStatus, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@zentla/database";

const DEFAULT_PROVIDER: ProviderType = "stripe";

export interface OfferWithVersions extends Offer {
  versions: OfferVersion[];
  currentVersion: OfferVersion | null;
}

export interface CreateOfferDto {
  name: string;
  description?: string;
  config?: OfferConfigDto;
  metadata?: Record<string, unknown>;
}

export interface OfferConfigDto {
  pricing: PricingConfigDto;
  trial?: TrialConfigDto;
  entitlements: EntitlementConfigDto[];
  metadata?: Record<string, unknown>;
  rawJson?: Record<string, unknown>;
}

export interface PricingConfigDto {
  model: "flat" | "per_unit" | "tiered" | "volume";
  currency: string;
  amount: number;
  interval?: "day" | "week" | "month" | "year";
  intervalCount?: number;
  usageType?: "licensed" | "metered";
  tiers?: PricingTierDto[];
}

export interface PricingTierDto {
  upTo: number | null;
  unitAmount: number;
  flatAmount?: number;
}

export interface TrialConfigDto {
  days: number;
  requirePaymentMethod: boolean;
}

export interface EntitlementConfigDto {
  featureKey: string;
  value: string | number | boolean;
  valueType: "boolean" | "number" | "string" | "unlimited";
}

export interface OfferQueryParams {
  limit: number;
  cursor?: string;
  status?: OfferStatus;
  search?: string;
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
  ) {}

  async findById(
    workspaceId: string,
    id: string,
  ): Promise<OfferWithVersions | null> {
    const offer = await this.prisma.offer.findFirst({
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

    return offer;
  }

  async findMany(
    workspaceId: string,
    params: OfferQueryParams,
  ): Promise<PaginatedResult<Offer>> {
    const { limit, cursor, status, search } = params;

    const where: Prisma.OfferWhereInput = {
      workspaceId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const offers = await this.prisma.offer.findMany({
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

    const hasMore = offers.length > limit;
    const data = hasMore ? offers.slice(0, -1) : offers;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async create(
    workspaceId: string,
    dto: CreateOfferDto,
  ): Promise<OfferWithVersions> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Create offer with draft status (becomes active when first version is published)
      const offer = await tx.offer.create({
        data: {
          workspaceId,
          name: dto.name,
          description: dto.description,
          status: "draft",
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      // Create initial draft version only if config is provided
      let version: OfferVersion | null = null;
      if (dto.config) {
        version = await tx.offerVersion.create({
          data: {
            offerId: offer.id,
            version: 1,
            status: "draft",
            config: JSON.parse(JSON.stringify(dto.config)),
          },
        });
      }

      return {
        ...offer,
        versions: version ? [version] : [],
        currentVersion: null,
      };
    });
  }

  async update(
    workspaceId: string,
    id: string,
    dto: Partial<Pick<Offer, "name" | "description">> & {
      metadata?: Record<string, unknown>;
    },
  ): Promise<Offer> {
    const offer = await this.prisma.offer.findFirst({
      where: { id, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    // Merge metadata if provided
    const updateData: Prisma.OfferUpdateInput = {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      version: { increment: 1 },
    };

    if (dto.metadata) {
      // Merge new metadata with existing
      const existingMetadata =
        (offer.metadata as Record<string, unknown>) ?? {};
      updateData.metadata = {
        ...existingMetadata,
        ...dto.metadata,
      } as Prisma.InputJsonValue;
    }

    return this.prisma.offer.update({
      where: { id },
      data: updateData,
    });
  }

  async archive(workspaceId: string, id: string): Promise<Offer> {
    const offer = await this.prisma.offer.findFirst({
      where: { id, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    // Archive in billing provider if product exists
    await this.archiveInProvider(workspaceId, id);

    return this.prisma.offer.update({
      where: { id },
      data: { status: "archived", version: { increment: 1 } },
    });
  }

  private async archiveInProvider(
    workspaceId: string,
    offerId: string,
    provider: ProviderType = DEFAULT_PROVIDER,
  ): Promise<void> {
    if (!this.billingService.isConfigured(provider)) {
      return;
    }

    try {
      const productRef = await this.providerRefService.findByEntity(
        workspaceId,
        "product",
        offerId,
        provider,
      );

      if (productRef) {
        const billingProvider = this.billingService.getProvider(provider);
        if (billingProvider.archiveProduct) {
          await billingProvider.archiveProduct(productRef.externalId);
          this.logger.log(
            `Archived offer ${offerId} in ${provider}: product=${productRef.externalId}`,
          );
        } else {
          this.logger.warn(`${provider} does not support archiveProduct`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to archive offer ${offerId} in ${provider}:`,
        error,
      );
      // Continue with local archive even if provider fails
    }
  }

  async createVersion(
    workspaceId: string,
    offerId: string,
    config: OfferConfigDto,
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    // Check if there's already a draft version
    const existingDraft = await this.prisma.offerVersion.findFirst({
      where: {
        offerId,
        status: "draft",
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        "A draft version already exists. Publish or delete it before creating a new version.",
      );
    }

    const nextVersion = (offer.versions[0]?.version ?? 0) + 1;

    return this.prisma.offerVersion.create({
      data: {
        offerId,
        version: nextVersion,
        status: "draft",
        config: JSON.parse(JSON.stringify(config)),
      },
    });
  }

  async updateDraftVersion(
    workspaceId: string,
    offerId: string,
    config: OfferConfigDto,
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    // Find the existing draft version
    const existingDraft = await this.prisma.offerVersion.findFirst({
      where: {
        offerId,
        status: "draft",
      },
    });

    if (!existingDraft) {
      throw new NotFoundException("No draft version found to update");
    }

    return this.prisma.offerVersion.update({
      where: { id: existingDraft.id },
      data: {
        config: JSON.parse(JSON.stringify(config)),
      },
    });
  }

  async createOrUpdateDraftVersion(
    workspaceId: string,
    offerId: string,
    config: OfferConfigDto,
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    // Check if there's already a draft version
    const existingDraft = await this.prisma.offerVersion.findFirst({
      where: {
        offerId,
        status: "draft",
      },
    });

    if (existingDraft) {
      // Update existing draft
      return this.prisma.offerVersion.update({
        where: { id: existingDraft.id },
        data: {
          config: JSON.parse(JSON.stringify(config)),
        },
      });
    }

    // Create new draft version
    const nextVersion = (offer.versions[0]?.version ?? 0) + 1;

    return this.prisma.offerVersion.create({
      data: {
        offerId,
        version: nextVersion,
        status: "draft",
        config: JSON.parse(JSON.stringify(config)),
      },
    });
  }

  async publishVersion(
    workspaceId: string,
    offerId: string,
    versionId?: string,
    effectiveFrom?: Date,
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    // Find the version to publish BEFORE starting transaction
    let versionToPublish: OfferVersion | null;

    if (versionId) {
      versionToPublish = await this.prisma.offerVersion.findFirst({
        where: { id: versionId, offerId },
      });
    } else {
      // Find the latest draft
      versionToPublish = await this.prisma.offerVersion.findFirst({
        where: { offerId, status: "draft" },
        orderBy: { version: "desc" },
      });
    }

    if (!versionToPublish) {
      throw new NotFoundException("No draft version found to publish");
    }

    if (versionToPublish.status !== "draft") {
      throw new BadRequestException("Only draft versions can be published");
    }

    // Validate pricing configuration BEFORE any changes
    const config = versionToPublish.config as Record<string, unknown>;
    if (!config?.pricing) {
      throw new BadRequestException(
        "Cannot publish: Offer version has no pricing configuration. Configure pricing in the Pricing tab first.",
      );
    }

    const pricing = config.pricing as Record<string, unknown>;
    if (!pricing.currency) {
      throw new BadRequestException(
        "Cannot publish: Pricing is missing currency. Configure pricing in the Pricing tab first.",
      );
    }

    if (pricing.amount === undefined || pricing.amount === null) {
      throw new BadRequestException(
        "Cannot publish: Pricing is missing amount. Configure pricing in the Pricing tab first.",
      );
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

    // Validate billing provider is configured (check workspace-level or global)
    if (
      !this.billingService.isConfiguredForWorkspace(
        workspaceId,
        DEFAULT_PROVIDER,
        workspaceSettings,
      )
    ) {
      throw new BadRequestException(
        `Cannot publish: ${DEFAULT_PROVIDER} is not configured. Check your billing settings.`,
      );
    }

    // Determine if this is an immediate publish or a scheduled one
    const now = new Date();
    const isScheduled = effectiveFrom && effectiveFrom > now;

    // Store previous state for potential rollback
    const previousVersionId = offer.currentVersionId;
    const previousOfferStatus = offer.status;

    const publishedVersion = await this.prisma.executeInTransaction(
      async (tx) => {
        // For immediate publish, archive currently published version
        // For scheduled publish, leave current version alone
        if (!isScheduled && offer.currentVersionId) {
          await tx.offerVersion.update({
            where: { id: offer.currentVersionId },
            data: { status: "archived" },
          });
        }

        // Publish the new version
        const published = await tx.offerVersion.update({
          where: { id: versionToPublish!.id },
          data: {
            status: "published",
            publishedAt: new Date(),
            effectiveFrom: effectiveFrom ?? null,
          },
        });

        // Only update offer's current version for immediate publishes
        if (!isScheduled) {
          await tx.offer.update({
            where: { id: offerId },
            data: {
              currentVersionId: published.id,
              // Activate offer when first version is published
              status: "active",
            },
          });
        }

        return published;
      },
    );

    // Sync to billing provider - if this fails, rollback database changes
    try {
      await this.syncToProvider(workspaceId, offer, publishedVersion);
    } catch (error) {
      this.logger.error(
        `Provider sync failed, rolling back publish for offer ${offerId}:`,
        error,
      );

      // Rollback: revert the database changes
      await this.prisma.executeInTransaction(async (tx) => {
        // Revert version status back to draft
        await tx.offerVersion.update({
          where: { id: publishedVersion.id },
          data: {
            status: "draft",
            publishedAt: null,
            effectiveFrom: null,
          },
        });

        // If we archived a previous version, restore it
        if (!isScheduled && previousVersionId) {
          await tx.offerVersion.update({
            where: { id: previousVersionId },
            data: { status: "published" },
          });
        }

        // Restore offer to previous state
        if (!isScheduled) {
          await tx.offer.update({
            where: { id: offerId },
            data: {
              currentVersionId: previousVersionId,
              status: previousOfferStatus,
            },
          });
        }
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
    offer: Offer,
    version: OfferVersion,
    provider: ProviderType = DEFAULT_PROVIDER,
  ): Promise<void> {
    if (!this.billingService.isConfigured(provider)) {
      throw new BadRequestException(
        `${provider} is not configured. Check your billing settings.`,
      );
    }

    // Validate that pricing config exists
    const config = version.config as Record<string, unknown>;
    if (!config?.pricing) {
      throw new BadRequestException(
        `Cannot sync to ${provider}: Offer version has no pricing configuration. Configure pricing in the Pricing tab first.`,
      );
    }

    const pricing = config.pricing as Record<string, unknown>;
    if (!pricing.currency) {
      throw new BadRequestException(
        `Cannot sync to ${provider}: Pricing is missing currency. Configure pricing in the Pricing tab first.`,
      );
    }

    if (pricing.amount === undefined || pricing.amount === null) {
      throw new BadRequestException(
        `Cannot sync to ${provider}: Pricing is missing amount. Configure pricing in the Pricing tab first.`,
      );
    }

    const billingProvider = this.billingService.getProvider(provider);

    // Check if we have an existing product ref
    const existingProductRef = await this.providerRefService.findByEntity(
      workspaceId,
      "product",
      offer.id,
      provider,
    );

    // Sync to provider
    const result = await billingProvider.syncOffer(
      offer as never, // Type cast for interface compatibility
      version as never,
      existingProductRef as never,
    );

    // Store product ref if new
    if (!existingProductRef) {
      await this.providerRefService.create({
        workspaceId,
        entityType: "product",
        entityId: offer.id,
        provider,
        externalId: result.productRef.externalId,
      });
    }

    // Store price ref for this version
    await this.providerRefService.create({
      workspaceId,
      entityType: "price",
      entityId: version.id,
      provider,
      externalId: result.priceRef.externalId,
    });

    this.logger.log(
      `Synced offer ${offer.id} version ${version.id} to ${provider}: product=${result.productRef.externalId}, price=${result.priceRef.externalId}`,
    );
  }

  async syncOfferToProvider(
    workspaceId: string,
    offerId: string,
    provider: ProviderType = DEFAULT_PROVIDER,
  ): Promise<{ success: boolean; message: string }> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
      include: { currentVersion: true },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    if (!offer.currentVersion) {
      throw new BadRequestException(
        "No published version to sync. Publish the offer first.",
      );
    }

    // Validate config has pricing
    const config = offer.currentVersion.config as Record<string, unknown>;
    if (!config?.pricing) {
      throw new BadRequestException(
        "Offer version has no pricing configuration. Edit the pricing tab and save.",
      );
    }

    const pricing = config.pricing as Record<string, unknown>;
    if (!pricing.currency) {
      throw new BadRequestException(
        "Offer pricing is missing currency. Edit the pricing tab and save.",
      );
    }

    try {
      await this.syncToProvider(
        workspaceId,
        offer,
        offer.currentVersion,
        provider,
      );
      return {
        success: true,
        message: `Offer synced to ${provider} successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync offer ${offerId} to ${provider}:`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to sync to ${provider}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async rollbackToVersion(
    workspaceId: string,
    offerId: string,
    targetVersionId: string,
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    const targetVersion = await this.prisma.offerVersion.findFirst({
      where: { id: targetVersionId, offerId },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Version ${targetVersionId} not found`);
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Get the latest version number
      const latestVersion = await tx.offerVersion.findFirst({
        where: { offerId },
        orderBy: { version: "desc" },
      });

      const newVersionNumber = (latestVersion?.version ?? 0) + 1;

      // Create a new version based on the target
      const newVersion = await tx.offerVersion.create({
        data: {
          offerId,
          version: newVersionNumber,
          status: "draft",
          config: targetVersion.config as Prisma.InputJsonValue,
        },
      });

      return newVersion;
    });
  }

  async getVersions(
    workspaceId: string,
    offerId: string,
  ): Promise<OfferVersion[]> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    return this.prisma.offerVersion.findMany({
      where: { offerId },
      orderBy: { version: "desc" },
    });
  }

  async getVersion(
    workspaceId: string,
    versionId: string,
  ): Promise<OfferVersion | null> {
    return this.prisma.offerVersion.findFirst({
      where: {
        id: versionId,
        offer: { workspaceId },
      },
    });
  }

  async getDraftVersion(
    workspaceId: string,
    offerId: string,
  ): Promise<OfferVersion | null> {
    return this.prisma.offerVersion.findFirst({
      where: {
        offerId,
        status: "draft",
        offer: { workspaceId },
      },
    });
  }

  async getPublishedVersion(
    workspaceId: string,
    offerId: string,
  ): Promise<OfferVersion | null> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
      include: { currentVersion: true },
    });

    return offer?.currentVersion ?? null;
  }

  /**
   * Gets the currently effective published version for an offer.
   *
   * A version is effective if:
   * - It has status 'published'
   * - Its effectiveFrom is null (immediately effective) or in the past
   *
   * When multiple versions match, the one with the most recent effectiveFrom is used.
   * If effectiveFrom is null, it's treated as less specific than a dated version.
   */
  async getEffectiveVersion(
    workspaceId: string,
    offerId: string,
    asOfDate?: Date,
  ): Promise<OfferVersion | null> {
    const now = asOfDate ?? new Date();

    // Find all published versions that are currently effective
    const effectiveVersions = await this.prisma.offerVersion.findMany({
      where: {
        offerId,
        status: "published",
        offer: { workspaceId },
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      },
      orderBy: [
        // Prefer versions with explicit effectiveFrom dates
        { effectiveFrom: { sort: "desc", nulls: "last" } },
        // Fall back to publishedAt for versions without effectiveFrom
        { publishedAt: "desc" },
      ],
      take: 1,
    });

    return effectiveVersions[0] ?? null;
  }

  /**
   * Gets all scheduled (future-dated) versions for an offer.
   *
   * Returns published versions whose effectiveFrom is in the future,
   * ordered by effectiveFrom ascending (soonest first).
   */
  async getScheduledVersions(
    workspaceId: string,
    offerId: string,
  ): Promise<OfferVersion[]> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    return this.prisma.offerVersion.findMany({
      where: {
        offerId,
        status: "published",
        effectiveFrom: { gt: new Date() },
        offer: { workspaceId },
      },
      orderBy: { effectiveFrom: "asc" },
    });
  }
}
