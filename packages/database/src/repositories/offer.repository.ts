import type { Offer, OfferVersion, OfferStatus } from "@prisma/client";
import type { PaginationParams, PaginatedResult } from "../types";

export interface OfferRepository {
  findById(workspaceId: string, id: string): Promise<OfferWithVersions | null>;
  findMany(
    workspaceId: string,
    params: OfferQueryParams,
  ): Promise<PaginatedResult<Offer>>;
  create(
    workspaceId: string,
    data: OfferCreateData,
  ): Promise<OfferWithVersions>;
  update(
    workspaceId: string,
    id: string,
    data: OfferUpdateData,
  ): Promise<Offer>;
  archive(workspaceId: string, id: string): Promise<Offer>;

  // Version management
  createVersion(
    workspaceId: string,
    offerId: string,
    data: OfferVersionCreateData,
  ): Promise<OfferVersion>;
  publishVersion(
    workspaceId: string,
    offerId: string,
    versionId?: string,
  ): Promise<OfferVersion>;
  archiveVersion(workspaceId: string, versionId: string): Promise<OfferVersion>;
  rollbackToVersion(
    workspaceId: string,
    offerId: string,
    targetVersionId: string,
  ): Promise<OfferVersion>;
  getVersions(workspaceId: string, offerId: string): Promise<OfferVersion[]>;
  getVersion(
    workspaceId: string,
    versionId: string,
  ): Promise<OfferVersion | null>;
  getDraftVersion(
    workspaceId: string,
    offerId: string,
  ): Promise<OfferVersion | null>;
  getPublishedVersion(
    workspaceId: string,
    offerId: string,
  ): Promise<OfferVersion | null>;
}

export interface OfferWithVersions extends Offer {
  versions: OfferVersion[];
  currentVersion: OfferVersion | null;
}

export interface OfferQueryParams extends PaginationParams {
  status?: OfferStatus;
  search?: string;
}

export interface OfferCreateData {
  name: string;
  description?: string;
  config: OfferConfig;
}

export interface OfferUpdateData {
  name?: string;
  description?: string;
}

export interface OfferVersionCreateData {
  config: OfferConfig;
}

export interface OfferConfig {
  pricing: PricingConfig;
  trial?: TrialConfig;
  entitlements: EntitlementConfig[];
  metadata?: Record<string, unknown>;
  rawJson?: Record<string, unknown>;
}

export interface PricingConfig {
  model: "flat" | "per_unit" | "tiered" | "volume";
  currency: string;
  amount: number;
  interval?: "day" | "week" | "month" | "year";
  intervalCount?: number;
  usageType?: "licensed" | "metered";
  tiers?: PricingTier[];
}

export interface PricingTier {
  upTo: number | null;
  unitAmount: number;
  flatAmount?: number;
}

export interface TrialConfig {
  days: number;
  requirePaymentMethod: boolean;
}

export interface EntitlementConfig {
  featureKey: string;
  value: string | number | boolean;
  valueType: "boolean" | "number" | "string" | "unlimited";
}
