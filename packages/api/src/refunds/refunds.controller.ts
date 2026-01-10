import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import type { RefundStatus, RefundReason } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { MemberOnly, AdminOnly, WorkspaceId } from "../common/decorators";
import { RefundsService } from "./refunds.service";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class QueryRefundsDto {
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

  @ApiPropertyOptional({
    description: "Filter by customer ID",
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: "Filter by invoice ID",
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: "Filter by status",
    enum: ["pending", "succeeded", "failed", "canceled"],
  })
  @IsOptional()
  @IsEnum(["pending", "succeeded", "failed", "canceled"])
  status?: RefundStatus;
}

class CreateRefundDto {
  @ApiPropertyOptional({
    description: "Invoice ID to refund",
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: "Stripe charge ID to refund",
  })
  @IsOptional()
  @IsString()
  chargeId?: string;

  @ApiPropertyOptional({
    description: "Stripe payment intent ID to refund",
  })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @ApiPropertyOptional({
    description: "Amount to refund in cents (defaults to full amount)",
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    description: "Reason for refund",
    enum: ["duplicate", "fraudulent", "requested_by_customer"],
  })
  @IsOptional()
  @IsEnum(["duplicate", "fraudulent", "requested_by_customer"])
  reason?: RefundReason;

  @ValidateIf((o) => !o.invoiceId && !o.chargeId && !o.paymentIntentId)
  @IsString({ message: "Must provide invoiceId, chargeId, or paymentIntentId" })
  _requireOneOf?: string;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

class RefundCustomerSchema {
  @ApiProperty({ description: "Customer ID" })
  id!: string;

  @ApiProperty({ description: "Customer email" })
  email!: string;

  @ApiPropertyOptional({ description: "Customer name" })
  name?: string;
}

class RefundInvoiceSchema {
  @ApiProperty({ description: "Invoice ID" })
  id!: string;

  @ApiProperty({ description: "Provider invoice ID" })
  providerInvoiceId!: string;

  @ApiProperty({ description: "Invoice total in cents" })
  total!: number;

  @ApiProperty({ description: "Currency code" })
  currency!: string;
}

class RefundSchema {
  @ApiProperty({ description: "Refund ID" })
  id!: string;

  @ApiProperty({ description: "Workspace ID" })
  workspaceId!: string;

  @ApiProperty({ description: "Customer ID" })
  customerId!: string;

  @ApiPropertyOptional({ description: "Invoice ID" })
  invoiceId?: string;

  @ApiProperty({ description: "Refund amount in cents" })
  amount!: number;

  @ApiProperty({ description: "Currency code" })
  currency!: string;

  @ApiProperty({
    description: "Refund status",
    enum: ["pending", "succeeded", "failed", "canceled"],
  })
  status!: string;

  @ApiPropertyOptional({
    description: "Reason for refund",
    enum: ["duplicate", "fraudulent", "requested_by_customer"],
  })
  reason?: string;

  @ApiPropertyOptional({ description: "Failure reason if refund failed" })
  failureReason?: string;

  @ApiProperty({ description: "Provider (stripe or zuora)" })
  provider!: string;

  @ApiProperty({ description: "Provider refund ID" })
  providerRefundId!: string;

  @ApiPropertyOptional({ description: "Provider charge ID" })
  providerChargeId?: string;

  @ApiPropertyOptional({ description: "Provider payment intent ID" })
  providerPaymentIntentId?: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt!: string;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt!: string;
}

class RefundWithRelationsSchema extends RefundSchema {
  @ApiProperty({ description: "Customer details", type: RefundCustomerSchema })
  customer!: RefundCustomerSchema;

  @ApiPropertyOptional({
    description: "Invoice details",
    type: RefundInvoiceSchema,
  })
  invoice?: RefundInvoiceSchema;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("refunds")
@ApiSecurity("api-key")
@Controller("refunds")
@MemberOnly()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  @ApiOperation({
    summary: "List refunds",
    description: `Returns all refunds for the workspace with optional filtering.

**Statuses:**
- \`pending\`: Refund is being processed
- \`succeeded\`: Refund completed successfully
- \`failed\`: Refund failed
- \`canceled\`: Refund was canceled`,
  })
  @ApiResponse({
    status: 200,
    description: "List of refunds",
    type: [RefundSchema],
  })
  async listRefunds(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryRefundsDto,
  ) {
    return this.refundsService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      customerId: query.customerId,
      invoiceId: query.invoiceId,
      status: query.status,
    });
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a refund",
    description:
      "Returns a single refund by ID with customer and invoice details.",
  })
  @ApiParam({ name: "id", description: "Refund ID" })
  @ApiResponse({
    status: 200,
    description: "Refund details",
    type: RefundWithRelationsSchema,
  })
  @ApiResponse({ status: 404, description: "Refund not found" })
  async getRefund(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const refund = await this.refundsService.findById(workspaceId, id);
    if (!refund) {
      throw new NotFoundException("Refund not found");
    }
    return refund;
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a refund",
    description: `Creates a refund for an invoice or charge.

**Requirements:**
- Must provide at least one of: invoiceId, chargeId, or paymentIntentId
- If invoiceId is provided, the invoice must be in \`paid\` status
- If amount is not provided, a full refund will be created
- Requires admin role`,
  })
  @ApiResponse({
    status: 201,
    description: "Refund created",
    type: RefundSchema,
  })
  @ApiResponse({ status: 400, description: "Invalid refund request" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async createRefund(
    @WorkspaceId() workspaceId: string,
    @Body() body: CreateRefundDto,
  ) {
    return this.refundsService.createRefund(workspaceId, {
      invoiceId: body.invoiceId,
      chargeId: body.chargeId,
      paymentIntentId: body.paymentIntentId,
      amount: body.amount,
      reason: body.reason,
    });
  }
}
