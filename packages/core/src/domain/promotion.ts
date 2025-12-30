export interface Promotion {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  description?: string;
  status: PromotionStatus;
  currentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PromotionStatus = 'active' | 'archived';

export interface PromotionVersion {
  id: string;
  promotionId: string;
  version: number;
  status: PromotionVersionStatus;
  config: PromotionConfig;
  publishedAt?: Date;
  createdAt: Date;
}

export type PromotionVersionStatus = 'draft' | 'published' | 'archived';

export interface PromotionConfig {
  discountType: DiscountType;
  discountValue: number; // percentage (0-100), cents, or days
  currency?: string; // Required for fixed_amount

  // Restrictions
  applicableOfferIds?: string[]; // Empty = all offers
  maxRedemptions?: number;
  maxRedemptionsPerCustomer?: number;
  minimumAmount?: number; // Minimum order in cents

  // Validity
  validFrom?: string; // ISO date
  validUntil?: string; // ISO date

  // Duration (for recurring discounts)
  duration?: PromotionDuration;
  durationInMonths?: number; // For 'repeating'

  metadata?: Record<string, unknown>;
}

export type DiscountType = 'percent' | 'fixed_amount' | 'free_trial_days';

export type PromotionDuration = 'once' | 'repeating' | 'forever';

export interface AppliedPromotion {
  id: string;
  workspaceId: string;
  promotionId: string;
  promotionVersionId: string;
  checkoutId?: string;
  subscriptionId?: string;
  customerId: string;
  discountAmount: number; // in cents
  appliedAt: Date;
}

export interface PromotionValidationResult {
  isValid: boolean;
  promotion?: Promotion;
  promotionVersion?: PromotionVersion;
  errorCode?: PromotionValidationError;
  errorMessage?: string;
}

export type PromotionValidationError =
  | 'not_found'
  | 'expired'
  | 'not_yet_valid'
  | 'max_redemptions_reached'
  | 'customer_limit_reached'
  | 'offer_not_applicable'
  | 'minimum_not_met'
  | 'not_published';
