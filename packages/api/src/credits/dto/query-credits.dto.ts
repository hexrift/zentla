import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class QueryCreditsDto {
  @ApiPropertyOptional({
    description: "Maximum number of results to return",
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
    description: "Cursor for pagination (ID of last item from previous page)",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: "Filter by customer ID" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: "Filter by status",
    enum: ["active", "depleted", "expired", "voided"],
  })
  @IsOptional()
  @IsEnum(["active", "depleted", "expired", "voided"])
  status?: string;
}
