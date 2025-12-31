import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
  IsNotEmpty,
  IsDateString,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import {
  ApiProperty,
  ApiPropertyOptional,
  ApiExtraModels,
} from "@nestjs/swagger";

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

export class PricingTierDto {
  @ApiProperty({
    description:
      "Upper limit of units for this tier. Use `null` for the final unlimited tier.",
    example: 100,
    nullable: true,
  })
  @IsNumber()
  upTo!: number | null;

  @ApiProperty({
    description:
      "Price per unit in smallest currency unit (e.g., cents for USD). Applied to units within this tier.",
    example: 1000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  unitAmount!: number;

  @ApiPropertyOptional({
    description:
      'Optional flat fee in smallest currency unit added when this tier is reached. Use for "base + per-unit" pricing.',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  flatAmount?: number;
}

export class PricingConfigDto {
  @ApiProperty({
    description: `Pricing model that determines how charges are calculated:
- **flat**: Fixed price regardless of usage (e.g., $29/month)
- **per_unit**: Price multiplied by quantity (e.g., $10/seat)
- **tiered**: Graduated pricing where each tier has different rates (e.g., first 10 units at $5, next 90 at $3)
- **volume**: All units priced at the tier rate based on total volume (e.g., 100 units = all at $3/unit)`,
    enum: ["flat", "per_unit", "tiered", "volume"],
    example: "flat",
  })
  @IsEnum(["flat", "per_unit", "tiered", "volume"])
  model!: "flat" | "per_unit" | "tiered" | "volume";

  @ApiProperty({
    description:
      "ISO 4217 three-letter currency code. Must match what your billing provider supports.",
    example: "USD",
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  currency!: string;

  @ApiProperty({
    description:
      "Price amount in smallest currency unit (e.g., cents for USD, pence for GBP). For tiered/volume pricing, this is ignored in favor of `tiers`.",
    example: 2900,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    description:
      "Billing interval for recurring subscriptions. Omit for one-time purchases.",
    enum: ["day", "week", "month", "year"],
    example: "month",
  })
  @IsOptional()
  @IsEnum(["day", "week", "month", "year"])
  interval?: "day" | "week" | "month" | "year";

  @ApiPropertyOptional({
    description:
      'Number of intervals between billings. For example, `interval: "month"` with `intervalCount: 3` bills quarterly. Default: 1.',
    example: 1,
    minimum: 1,
    maximum: 12,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  intervalCount?: number;

  @ApiPropertyOptional({
    description: `Usage type for metered billing:
- **licensed**: Charge for pre-set quantity (default)
- **metered**: Charge based on reported usage at end of billing period`,
    enum: ["licensed", "metered"],
    default: "licensed",
  })
  @IsOptional()
  @IsEnum(["licensed", "metered"])
  usageType?: "licensed" | "metered";

  @ApiPropertyOptional({
    description:
      'Pricing tiers for tiered/volume pricing models. Required when `model` is "tiered" or "volume". Last tier should have `upTo: null`.',
    type: [PricingTierDto],
    example: [
      { upTo: 10, unitAmount: 1000 },
      { upTo: 100, unitAmount: 800 },
      { upTo: null, unitAmount: 500 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTierDto)
  tiers?: PricingTierDto[];
}

export class TrialConfigDto {
  @ApiProperty({
    description:
      "Length of trial period in days. Customer will not be charged during this period.",
    example: 14,
    minimum: 1,
    maximum: 365,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;

  @ApiProperty({
    description:
      "If true, customer must provide payment method to start trial (reduces fraud, enables auto-conversion). If false, trial can start without payment info.",
    example: true,
  })
  @IsBoolean()
  requirePaymentMethod!: boolean;
}

export class EntitlementConfigDto {
  @ApiProperty({
    description:
      'Unique identifier for the feature this entitlement grants access to. Use consistent naming across offers (e.g., "api_calls", "seats", "storage_gb").',
    example: "api_calls",
  })
  @IsString()
  featureKey!: string;

  @ApiProperty({
    description: `The entitlement value. Interpretation depends on valueType:
- boolean: true/false for feature access
- number: quantity limit (e.g., 1000 for "1000 API calls")
- string: tier name or custom value
- unlimited: use true for unlimited access`,
    example: 1000,
    oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
  })
  @IsNotEmpty()
  value!: string | number | boolean;

  @ApiProperty({
    description: `How to interpret the value:
- **boolean**: Feature is enabled/disabled
- **number**: Numeric limit or quota
- **string**: Text value (e.g., tier name)
- **unlimited**: No limit on this feature`,
    enum: ["boolean", "number", "string", "unlimited"],
    example: "number",
  })
  @IsEnum(["boolean", "number", "string", "unlimited"])
  valueType!: "boolean" | "number" | "string" | "unlimited";
}

@ApiExtraModels(PricingConfigDto, TrialConfigDto, EntitlementConfigDto)
export class OfferConfigDto {
  @ApiProperty({
    description:
      "Pricing configuration defining how much and how often to charge.",
    type: PricingConfigDto,
  })
  @ValidateNested()
  @Type(() => PricingConfigDto)
  pricing!: PricingConfigDto;

  @ApiPropertyOptional({
    description:
      "Optional trial period configuration. When set, new subscribers start with a free trial before being charged.",
    type: TrialConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TrialConfigDto)
  trial?: TrialConfigDto;

  @ApiProperty({
    description:
      "List of entitlements (features/quotas) granted to subscribers of this offer. These are provisioned when a subscription becomes active and revoked when it ends.",
    type: [EntitlementConfigDto],
    example: [
      { featureKey: "seats", value: 5, valueType: "number" },
      { featureKey: "api_access", value: true, valueType: "boolean" },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntitlementConfigDto)
  entitlements!: EntitlementConfigDto[];

  @ApiPropertyOptional({
    description:
      "Arbitrary key-value metadata stored with the offer. Useful for internal tracking, feature flags, or integration data.",
    example: { internal_sku: "PRO-2024", feature_tier: "professional" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Escape hatch for advanced billing provider configuration not covered by standard fields. Passed directly to the provider during sync. Use sparingly.",
  })
  @IsOptional()
  @IsObject()
  rawJson?: Record<string, unknown>;
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class CreateOfferRequestDto {
  @ApiProperty({
    description:
      "Human-readable name for the offer. Displayed in admin dashboards and may be shown to customers.",
    example: "Pro Plan",
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description:
      "Optional description explaining the offer. Useful for distinguishing similar offers.",
    example: "Best for growing teams with up to 25 members",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      "Optional offer configuration including pricing, trial, and entitlements. If provided, this becomes version 1 (draft) of the offer. If omitted, create the configuration later via POST /offers/{id}/versions.",
    type: OfferConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferConfigDto)
  config?: OfferConfigDto;

  @ApiPropertyOptional({
    description:
      "Campaign and context metadata for attribution tracking. Flows through to subscriptions and webhook events.",
    example: {
      campaign: "summer_2025",
      channel: "website",
      source: "google",
      internal_ref: "deal-123",
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateVersionRequestDto {
  @ApiProperty({
    description:
      "New configuration for this version. Changes take effect only after publishing. Existing subscribers remain on their current version.",
    type: OfferConfigDto,
  })
  @ValidateNested()
  @Type(() => OfferConfigDto)
  config!: OfferConfigDto;
}

export class UpdateOfferDto {
  @ApiPropertyOptional({
    description:
      "Updated offer name. Changes apply immediately to the offer (not version-specific).",
    example: "Professional Plan",
    minLength: 1,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Updated offer description.",
    example: "Our most popular plan for teams",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      "Campaign and context metadata for attribution tracking. Merged with existing metadata.",
    example: { campaign: "winter_2025", source: "affiliate" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PublishOfferDto {
  @ApiPropertyOptional({
    description:
      "UUID of the specific version to publish. If omitted, publishes the latest draft version. Only draft versions can be published.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional({
    description: `When this version becomes effective for new checkouts.

**Scheduling behavior:**
- **Omit or null**: Version is immediately effective upon publishing
- **Past date**: Same as immediate - version is effective now
- **Future date**: Version is published but not used until that date/time

**How scheduled versions work:**
- The version enters "published" status immediately
- New checkouts use the most recent effective version at checkout time
- Existing subscriptions are not affected

**Use cases:**
- Schedule a price increase for next quarter
- Prepare a holiday promotion to go live automatically
- Coordinate pricing changes across time zones

**Note:** Stripe prices are created immediately even for future-dated versions.`,
    example: "2025-02-01T00:00:00Z",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class RollbackOfferDto {
  @ApiProperty({
    description:
      "UUID of a previously published version to use as the basis for a new draft. This creates a new draft version with the same config as the target version.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsUUID()
  targetVersionId!: string;
}

// ============================================================================
// QUERY DTOs
// ============================================================================

export class QueryOffersDto {
  @ApiPropertyOptional({
    description: "Maximum number of offers to return per page.",
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      "Pagination cursor from a previous response. Pass `nextCursor` from the last response to get the next page.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description:
      "Filter by offer status. Draft offers are being configured; active offers can be used for new subscriptions; archived offers are hidden but preserve historical data.",
    enum: ["draft", "active", "archived"],
    example: "active",
  })
  @IsOptional()
  @IsEnum(["draft", "active", "archived"])
  status?: "draft" | "active" | "archived";

  @ApiPropertyOptional({
    description: "Case-insensitive search across offer name and description.",
    example: "pro",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
