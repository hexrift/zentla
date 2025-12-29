import { IsString, IsOptional, IsEnum, IsNumber, IsInt, Min, Max, IsUUID, IsBoolean, IsArray, ValidateNested, IsObject, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PricingTierDto {
  @ApiProperty({ description: 'Upper limit for this tier, null for unlimited' })
  @IsNumber()
  upTo!: number | null;

  @ApiProperty({ description: 'Unit amount in cents' })
  @IsInt()
  @Min(0)
  unitAmount!: number;

  @ApiPropertyOptional({ description: 'Flat amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  flatAmount?: number;
}

export class PricingConfigDto {
  @ApiProperty({ enum: ['flat', 'per_unit', 'tiered', 'volume'] })
  @IsEnum(['flat', 'per_unit', 'tiered', 'volume'])
  model!: 'flat' | 'per_unit' | 'tiered' | 'volume';

  @ApiProperty({ description: 'ISO 4217 currency code' })
  @IsString()
  currency!: string;

  @ApiProperty({ description: 'Amount in smallest currency unit (cents)' })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'] })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  interval?: 'day' | 'week' | 'month' | 'year';

  @ApiPropertyOptional({ description: 'Number of intervals between billings' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  intervalCount?: number;

  @ApiPropertyOptional({ enum: ['licensed', 'metered'] })
  @IsOptional()
  @IsEnum(['licensed', 'metered'])
  usageType?: 'licensed' | 'metered';

  @ApiPropertyOptional({ type: [PricingTierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTierDto)
  tiers?: PricingTierDto[];
}

export class TrialConfigDto {
  @ApiProperty({ description: 'Number of trial days' })
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;

  @ApiProperty({ description: 'Whether payment method is required for trial' })
  @IsBoolean()
  requirePaymentMethod!: boolean;
}

export class EntitlementConfigDto {
  @ApiProperty({ description: 'Unique feature identifier' })
  @IsString()
  featureKey!: string;

  @ApiProperty({ description: 'Feature value' })
  @IsNotEmpty()
  value!: string | number | boolean;

  @ApiProperty({ enum: ['boolean', 'number', 'string', 'unlimited'] })
  @IsEnum(['boolean', 'number', 'string', 'unlimited'])
  valueType!: 'boolean' | 'number' | 'string' | 'unlimited';
}

export class OfferConfigDto {
  @ApiProperty({ type: PricingConfigDto })
  @ValidateNested()
  @Type(() => PricingConfigDto)
  pricing!: PricingConfigDto;

  @ApiPropertyOptional({ type: TrialConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TrialConfigDto)
  trial?: TrialConfigDto;

  @ApiProperty({ type: [EntitlementConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntitlementConfigDto)
  entitlements!: EntitlementConfigDto[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Raw JSON escape hatch for advanced config' })
  @IsOptional()
  @IsObject()
  rawJson?: Record<string, unknown>;
}

export class CreateOfferRequestDto {
  @ApiProperty({ description: 'Offer name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Offer description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: OfferConfigDto })
  @ValidateNested()
  @Type(() => OfferConfigDto)
  config!: OfferConfigDto;
}

export class CreateVersionRequestDto {
  @ApiProperty({ type: OfferConfigDto })
  @ValidateNested()
  @Type(() => OfferConfigDto)
  config!: OfferConfigDto;
}

export class UpdateOfferDto {
  @ApiPropertyOptional({ description: 'Offer name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Offer description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class PublishOfferDto {
  @ApiPropertyOptional({ description: 'Specific version ID to publish (defaults to latest draft)' })
  @IsOptional()
  @IsUUID()
  versionId?: string;
}

export class RollbackOfferDto {
  @ApiProperty({ description: 'Target version ID to rollback to' })
  @IsUUID()
  targetVersionId!: string;
}

export class QueryOffersDto {
  @ApiPropertyOptional({ description: 'Number of results to return', default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ['active', 'archived'] })
  @IsOptional()
  @IsEnum(['active', 'archived'])
  status?: 'active' | 'archived';

  @ApiPropertyOptional({ description: 'Search term for name/description' })
  @IsOptional()
  @IsString()
  search?: string;
}
