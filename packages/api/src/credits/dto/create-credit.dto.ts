import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreateCreditDto {
  @ApiProperty({ description: "Customer ID to issue credit to" })
  @IsString()
  customerId!: string;

  @ApiProperty({ description: "Credit amount in cents", minimum: 1 })
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: "Currency code (e.g., usd, eur)" })
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiPropertyOptional({
    description: "Reason for issuing credit",
    enum: [
      "promotional",
      "refund_alternative",
      "goodwill",
      "billing_error",
      "service_credit",
      "other",
    ],
  })
  @IsOptional()
  @IsEnum([
    "promotional",
    "refund_alternative",
    "goodwill",
    "billing_error",
    "service_credit",
    "other",
  ])
  reason?: string;

  @ApiPropertyOptional({ description: "Description of the credit" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "Expiration date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
