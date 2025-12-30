import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ProviderRefService } from '../billing/provider-ref.service';
import type {
  Offer,
  OfferVersion,
  OfferStatus,
  Prisma,
} from '@prisma/client';
import type { PaginatedResult } from '@relay/database';

export interface OfferWithVersions extends Offer {
  versions: OfferVersion[];
  currentVersion: OfferVersion | null;
}

export interface CreateOfferDto {
  name: string;
  description?: string;
  config: OfferConfigDto;
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
  model: 'flat' | 'per_unit' | 'tiered' | 'volume';
  currency: string;
  amount: number;
  interval?: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
  usageType?: 'licensed' | 'metered';
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
  valueType: 'boolean' | 'number' | 'string' | 'unlimited';
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

  async findById(workspaceId: string, id: string): Promise<OfferWithVersions | null> {
    const offer = await this.prisma.offer.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
        currentVersion: true,
      },
    });

    return offer;
  }

  async findMany(
    workspaceId: string,
    params: OfferQueryParams
  ): Promise<PaginatedResult<Offer>> {
    const { limit, cursor, status, search } = params;

    const where: Prisma.OfferWhereInput = {
      workspaceId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
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
      orderBy: { createdAt: 'desc' },
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

  async create(workspaceId: string, dto: CreateOfferDto): Promise<OfferWithVersions> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Create offer
      const offer = await tx.offer.create({
        data: {
          workspaceId,
          name: dto.name,
          description: dto.description,
          status: 'active',
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      // Create initial draft version
      const version = await tx.offerVersion.create({
        data: {
          offerId: offer.id,
          version: 1,
          status: 'draft',
          config: JSON.parse(JSON.stringify(dto.config)),
        },
      });

      return {
        ...offer,
        versions: [version],
        currentVersion: null,
      };
    });
  }

  async update(
    workspaceId: string,
    id: string,
    dto: Partial<Pick<Offer, 'name' | 'description'>> & { metadata?: Record<string, unknown> }
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
      const existingMetadata = (offer.metadata as Record<string, unknown>) ?? {};
      updateData.metadata = { ...existingMetadata, ...dto.metadata } as Prisma.InputJsonValue;
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

    return this.prisma.offer.update({
      where: { id },
      data: { status: 'archived', version: { increment: 1 } },
    });
  }

  async createVersion(
    workspaceId: string,
    offerId: string,
    config: OfferConfigDto
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
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
        status: 'draft',
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        'A draft version already exists. Publish or delete it before creating a new version.'
      );
    }

    const nextVersion = (offer.versions[0]?.version ?? 0) + 1;

    return this.prisma.offerVersion.create({
      data: {
        offerId,
        version: nextVersion,
        status: 'draft',
        config: JSON.parse(JSON.stringify(config)),
      },
    });
  }

  async publishVersion(
    workspaceId: string,
    offerId: string,
    versionId?: string,
    effectiveFrom?: Date
  ): Promise<OfferVersion> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    // Determine if this is an immediate publish or a scheduled one
    const now = new Date();
    const isScheduled = effectiveFrom && effectiveFrom > now;

    const publishedVersion = await this.prisma.executeInTransaction(async (tx) => {
      // Find the version to publish
      let versionToPublish: OfferVersion | null;

      if (versionId) {
        versionToPublish = await tx.offerVersion.findFirst({
          where: { id: versionId, offerId },
        });
      } else {
        // Find the latest draft
        versionToPublish = await tx.offerVersion.findFirst({
          where: { offerId, status: 'draft' },
          orderBy: { version: 'desc' },
        });
      }

      if (!versionToPublish) {
        throw new NotFoundException('No draft version found to publish');
      }

      if (versionToPublish.status !== 'draft') {
        throw new BadRequestException('Only draft versions can be published');
      }

      // For immediate publish, archive currently published version
      // For scheduled publish, leave current version alone
      if (!isScheduled && offer.currentVersionId) {
        await tx.offerVersion.update({
          where: { id: offer.currentVersionId },
          data: { status: 'archived' },
        });
      }

      // Publish the new version
      const published = await tx.offerVersion.update({
        where: { id: versionToPublish.id },
        data: {
          status: 'published',
          publishedAt: new Date(),
          effectiveFrom: effectiveFrom ?? null,
        },
      });

      // Only update offer's current version for immediate publishes
      if (!isScheduled) {
        await tx.offer.update({
          where: { id: offerId },
          data: { currentVersionId: published.id },
        });
      }

      return published;
    });

    // Sync to Stripe (after transaction commits)
    // We sync even for scheduled versions so the price exists in Stripe
    await this.syncToStripe(workspaceId, offer, publishedVersion);

    return publishedVersion;
  }

  private async syncToStripe(
    workspaceId: string,
    offer: Offer,
    version: OfferVersion
  ): Promise<void> {
    if (!this.billingService.isConfigured('stripe')) {
      this.logger.warn('Stripe not configured, skipping sync');
      return;
    }

    try {
      const stripeAdapter = this.billingService.getStripeAdapter();

      // Check if we have an existing product ref
      const existingProductRef = await this.providerRefService.findByEntity(
        workspaceId,
        'product',
        offer.id,
        'stripe'
      );

      // Sync to Stripe
      const result = await stripeAdapter.syncOffer(
        offer as never, // Type cast for interface compatibility
        version as never,
        existingProductRef as never
      );

      // Store product ref if new
      if (!existingProductRef) {
        await this.providerRefService.create({
          workspaceId,
          entityType: 'product',
          entityId: offer.id,
          provider: 'stripe',
          externalId: result.productRef.externalId,
        });
      }

      // Store price ref for this version
      await this.providerRefService.create({
        workspaceId,
        entityType: 'price',
        entityId: version.id,
        provider: 'stripe',
        externalId: result.priceRef.externalId,
      });

      this.logger.log(
        `Synced offer ${offer.id} version ${version.id} to Stripe: product=${result.productRef.externalId}, price=${result.priceRef.externalId}`
      );
    } catch (error) {
      this.logger.error(`Failed to sync offer to Stripe: ${error}`);
      // Don't throw - offer is published in our DB even if Stripe sync fails
      // In production, you might want to queue a retry or alert
    }
  }

  async rollbackToVersion(
    workspaceId: string,
    offerId: string,
    targetVersionId: string
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
        orderBy: { version: 'desc' },
      });

      const newVersionNumber = (latestVersion?.version ?? 0) + 1;

      // Create a new version based on the target
      const newVersion = await tx.offerVersion.create({
        data: {
          offerId,
          version: newVersionNumber,
          status: 'draft',
          config: targetVersion.config as Prisma.InputJsonValue,
        },
      });

      return newVersion;
    });
  }

  async getVersions(workspaceId: string, offerId: string): Promise<OfferVersion[]> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    return this.prisma.offerVersion.findMany({
      where: { offerId },
      orderBy: { version: 'desc' },
    });
  }

  async getVersion(workspaceId: string, versionId: string): Promise<OfferVersion | null> {
    return this.prisma.offerVersion.findFirst({
      where: {
        id: versionId,
        offer: { workspaceId },
      },
    });
  }

  async getDraftVersion(workspaceId: string, offerId: string): Promise<OfferVersion | null> {
    return this.prisma.offerVersion.findFirst({
      where: {
        offerId,
        status: 'draft',
        offer: { workspaceId },
      },
    });
  }

  async getPublishedVersion(workspaceId: string, offerId: string): Promise<OfferVersion | null> {
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
    asOfDate?: Date
  ): Promise<OfferVersion | null> {
    const now = asOfDate ?? new Date();

    // Find all published versions that are currently effective
    const effectiveVersions = await this.prisma.offerVersion.findMany({
      where: {
        offerId,
        status: 'published',
        offer: { workspaceId },
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: now } },
        ],
      },
      orderBy: [
        // Prefer versions with explicit effectiveFrom dates
        { effectiveFrom: { sort: 'desc', nulls: 'last' } },
        // Fall back to publishedAt for versions without effectiveFrom
        { publishedAt: 'desc' },
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
  async getScheduledVersions(workspaceId: string, offerId: string): Promise<OfferVersion[]> {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, workspaceId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    return this.prisma.offerVersion.findMany({
      where: {
        offerId,
        status: 'published',
        effectiveFrom: { gt: new Date() },
        offer: { workspaceId },
      },
      orderBy: { effectiveFrom: 'asc' },
    });
  }
}
