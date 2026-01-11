import { IsString, IsInt, IsOptional, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class ApplyCreditDto {
  @ApiProperty({ description: "Invoice ID to apply credits to" })
  @IsString()
  invoiceId!: string;

  @ApiPropertyOptional({
    description:
      "Maximum amount to apply in cents (defaults to invoice amount remaining)",
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  maxAmount?: number;
}

export class VoidCreditDto {
  @ApiPropertyOptional({ description: "Reason for voiding the credit" })
  @IsOptional()
  @IsString()
  reason?: string;
}
