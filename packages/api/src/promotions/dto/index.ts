import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsArray,
  ValidateNested,
  IsObject,
  Matches,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, ApiExtraModels } from '@nestjs/swagger';

// ============================================================================
// PROMOTION CONFIGURATION
// ============================================================================

@ApiExtraModels()
export class PromotionConfigDto {
  @ApiProperty({
    description: `The type of discount to apply:
- **percent**: Percentage off the order (e.g., 25% off)
- **fixed_amount**: Fixed monetary discount in smallest currency unit (e.g., 1000 = $10.00 off)
- **free_trial_days**: Extend or grant a free trial period (e.g., 14 extra days)`,
    enum: ['percent', 'fixed_amount', 'free_trial_days'],
    example: 'percent',
  })
  @IsEnum(['percent', 'fixed_amount', 'free_trial_days'])
  discountType!: 'percent' | 'fixed_amount' | 'free_trial_days';

  @ApiProperty({
    description: `The discount amount. Interpretation depends on discountType:
- For **percent**: Value from 0-100 (e.g., 25 means 25% off)
- For **fixed_amount**: Amount in smallest currency unit (e.g., 1000 = $10.00)
- For **free_trial_days**: Number of trial days to grant (e.g., 14)`,
    example: 25,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 three-letter currency code. **Required** when discountType is "fixed_amount". Ignored for percent and free_trial_days.',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: `List of offer IDs this promotion can be applied to. When empty or omitted, the promotion applies to **all offers** in the workspace. Use this to restrict promotions to specific plans.`,
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  applicableOfferIds?: string[];

  @ApiPropertyOptional({
    description: 'Maximum number of times this promotion can be redeemed across all customers. Once reached, the promotion code becomes invalid. Omit for unlimited redemptions.',
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @ApiPropertyOptional({
    description: 'Maximum times a single customer can redeem this promotion. Prevents abuse while allowing legitimate repeat purchases. Omit for unlimited per-customer redemptions.',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionsPerCustomer?: number;

  @ApiPropertyOptional({
    description: 'Minimum order amount in smallest currency unit (e.g., cents) required to use this promotion. Useful for "spend $50, get 10% off" promotions.',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumAmount?: number;

  @ApiPropertyOptional({
    description: 'Date and time when the promotion becomes valid (ISO 8601 format). Before this time, the promotion code will be rejected during validation. Omit for immediate availability.',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Date and time when the promotion expires (ISO 8601 format). After this time, the promotion code will be rejected. Omit for no expiration.',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({
    description: `How long the discount applies for recurring subscriptions:
- **once**: Discount applies only to the first invoice
- **repeating**: Discount applies for a specified number of months (see durationInMonths)
- **forever**: Discount applies to all future invoices for the subscription lifetime

Default behavior when omitted: "once" for percent/fixed_amount, N/A for free_trial_days.`,
    enum: ['once', 'repeating', 'forever'],
    example: 'repeating',
  })
  @IsOptional()
  @IsEnum(['once', 'repeating', 'forever'])
  duration?: 'once' | 'repeating' | 'forever';

  @ApiPropertyOptional({
    description: 'Number of months to apply the discount when duration is "repeating". Required if duration is "repeating", ignored otherwise.',
    example: 3,
    minimum: 1,
    maximum: 36,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  durationInMonths?: number;

  @ApiPropertyOptional({
    description: 'Arbitrary key-value metadata stored with the promotion version. Useful for internal tracking, campaign attribution, or integration data.',
    example: { campaign: 'black_friday_2024', source: 'email' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class CreatePromotionRequestDto {
  @ApiProperty({
    description: `Unique promotion code that customers enter at checkout. This is the user-facing code (e.g., "SUMMER25", "WELCOME10"). Must be unique within the workspace.

**Format requirements:**
- 2-50 characters
- Alphanumeric characters, underscores, and hyphens only
- Case-insensitive (stored and matched as-is)`,
    example: 'SUMMER25',
    pattern: '^[A-Z0-9_-]{2,50}$',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,50}$/i, {
    message: 'Code must be 2-50 characters, alphanumeric with underscores and hyphens',
  })
  code!: string;

  @ApiProperty({
    description: 'Human-readable name for the promotion. Displayed in admin dashboards and reports. Helps distinguish promotions with similar codes.',
    example: 'Summer 2024 Sale - 25% Off',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional description explaining the promotion purpose, terms, or target audience. For internal reference only.',
    example: 'Annual summer promotion for newsletter subscribers. Valid June-August.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Complete promotion configuration including discount type, value, restrictions, and validity period. This becomes version 1 (draft) of the promotion.',
    type: PromotionConfigDto,
  })
  @ValidateNested()
  @Type(() => PromotionConfigDto)
  config!: PromotionConfigDto;
}

export class CreatePromotionVersionRequestDto {
  @ApiProperty({
    description: `New configuration for this promotion version. Changes to discount values, restrictions, or validity dates require creating a new version.

**When to create a new version:**
- Changing discount amount or type
- Modifying redemption limits
- Adjusting validity dates
- Adding or removing applicable offers

The new version starts as a draft and must be published to take effect.`,
    type: PromotionConfigDto,
  })
  @ValidateNested()
  @Type(() => PromotionConfigDto)
  config!: PromotionConfigDto;
}

export class UpdatePromotionDto {
  @ApiPropertyOptional({
    description: 'Updated promotion name. Changes apply immediately and are visible in all admin interfaces. Does not affect the promotion code or configuration.',
    example: 'Summer 2024 Sale (Extended)',
    minLength: 1,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated promotion description. For internal reference only.',
    example: 'Extended through September due to popular demand.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class PublishPromotionDto {
  @ApiPropertyOptional({
    description: `UUID of the specific version to publish. When omitted, publishes the latest draft version. Only versions in "draft" status can be published.

**What happens on publish:**
1. Target version status changes from "draft" to "published"
2. Previously published version (if any) becomes "archived"
3. Promotion syncs to billing provider (creates Stripe coupon and promotion code)
4. Promotion code becomes usable in checkout sessions`,
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  versionId?: string;
}

export class ValidatePromotionDto {
  @ApiProperty({
    description: 'The promotion code to validate (e.g., "SUMMER25"). Case-sensitive lookup against stored codes.',
    example: 'SUMMER25',
  })
  @IsString()
  code!: string;

  @ApiProperty({
    description: 'The offer ID to check compatibility against. Validates that the promotion is applicable to this specific offer (if applicableOfferIds is set).',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  offerId!: string;

  @ApiPropertyOptional({
    description: 'Customer ID to check per-customer redemption limits. If the customer has already reached maxRedemptionsPerCustomer, validation fails.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Order amount in smallest currency unit (e.g., cents) to check against minimumAmount requirement. If below the minimum, validation fails.',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderAmount?: number;
}

// ============================================================================
// QUERY DTOs
// ============================================================================

export class QueryPromotionsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of promotions to return per page.',
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
    description: 'Pagination cursor from a previous response. Pass `nextCursor` from the last response to fetch the next page of results.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Filter by promotion status. Active promotions can be used for new checkouts; archived promotions are hidden but preserved for historical reference.',
    enum: ['active', 'archived'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'archived'])
  status?: 'active' | 'archived';

  @ApiPropertyOptional({
    description: 'Case-insensitive search across promotion code and name. Useful for finding promotions by partial code or campaign name.',
    example: 'SUMMER',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
