import {
  Controller,
  Get,
  Post,
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
import type { InvoiceStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, IsEnum, Max, Min } from "class-validator";
import { MemberOnly, AdminOnly, WorkspaceId } from "../common/decorators";
import { InvoicesService } from "./invoices.service";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class QueryInvoicesDto {
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
    description: "Filter by subscription ID",
  })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({
    description: "Filter by status",
    enum: ["draft", "open", "paid", "void", "uncollectible"],
  })
  @IsOptional()
  @IsEnum(["draft", "open", "paid", "void", "uncollectible"])
  status?: InvoiceStatus;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

class InvoiceLineItemSchema {
  @ApiProperty({ description: "Line item ID" })
  id!: string;

  @ApiProperty({ description: "Line item description" })
  description!: string;

  @ApiProperty({ description: "Quantity" })
  quantity!: number;

  @ApiProperty({ description: "Unit amount in cents" })
  unitAmount!: number;

  @ApiProperty({ description: "Total amount in cents" })
  amount!: number;

  @ApiProperty({ description: "Currency code" })
  currency!: string;

  @ApiPropertyOptional({ description: "Period start date" })
  periodStart?: string;

  @ApiPropertyOptional({ description: "Period end date" })
  periodEnd?: string;
}

class InvoiceCustomerSchema {
  @ApiProperty({ description: "Customer ID" })
  id!: string;

  @ApiProperty({ description: "Customer email" })
  email!: string;

  @ApiPropertyOptional({ description: "Customer name" })
  name?: string;
}

class InvoiceSchema {
  @ApiProperty({ description: "Invoice ID" })
  id!: string;

  @ApiProperty({ description: "Workspace ID" })
  workspaceId!: string;

  @ApiProperty({ description: "Customer ID" })
  customerId!: string;

  @ApiPropertyOptional({ description: "Subscription ID" })
  subscriptionId?: string;

  @ApiProperty({ description: "Amount due in cents" })
  amountDue!: number;

  @ApiProperty({ description: "Amount paid in cents" })
  amountPaid!: number;

  @ApiProperty({ description: "Amount remaining in cents" })
  amountRemaining!: number;

  @ApiProperty({ description: "Subtotal in cents" })
  subtotal!: number;

  @ApiProperty({ description: "Tax amount in cents" })
  tax!: number;

  @ApiProperty({ description: "Total in cents" })
  total!: number;

  @ApiProperty({ description: "Currency code" })
  currency!: string;

  @ApiProperty({
    description: "Invoice status",
    enum: ["draft", "open", "paid", "void", "uncollectible"],
  })
  status!: string;

  @ApiPropertyOptional({ description: "Billing period start" })
  periodStart?: string;

  @ApiPropertyOptional({ description: "Billing period end" })
  periodEnd?: string;

  @ApiPropertyOptional({ description: "Due date" })
  dueDate?: string;

  @ApiPropertyOptional({ description: "Date paid" })
  paidAt?: string;

  @ApiPropertyOptional({ description: "Date voided" })
  voidedAt?: string;

  @ApiProperty({ description: "Provider (stripe or zuora)" })
  provider!: string;

  @ApiProperty({ description: "Provider invoice ID" })
  providerInvoiceId!: string;

  @ApiPropertyOptional({ description: "Link to invoice in provider dashboard" })
  providerInvoiceUrl?: string;

  @ApiProperty({ description: "Payment attempt count" })
  attemptCount!: number;

  @ApiPropertyOptional({ description: "Next payment attempt date" })
  nextPaymentAttempt?: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt!: string;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt!: string;
}

class InvoiceWithLineItemsSchema extends InvoiceSchema {
  @ApiProperty({ description: "Customer details", type: InvoiceCustomerSchema })
  customer!: InvoiceCustomerSchema;

  @ApiProperty({
    description: "Invoice line items",
    type: [InvoiceLineItemSchema],
  })
  lineItems!: InvoiceLineItemSchema[];
}

class PdfUrlResponseSchema {
  @ApiProperty({ description: "PDF download URL" })
  url!: string;

  @ApiProperty({ description: "URL expiration time" })
  expiresAt!: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("invoices")
@ApiSecurity("api-key")
@Controller("invoices")
@MemberOnly()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: "List invoices",
    description: `Returns all invoices for the workspace with optional filtering.

**Statuses:**
- \`draft\`: Invoice created but not finalized
- \`open\`: Invoice sent, awaiting payment
- \`paid\`: Invoice has been paid
- \`void\`: Invoice was voided
- \`uncollectible\`: Invoice marked as uncollectible`,
  })
  @ApiResponse({
    status: 200,
    description: "List of invoices",
    type: [InvoiceSchema],
  })
  async listInvoices(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryInvoicesDto,
  ) {
    return this.invoicesService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      customerId: query.customerId,
      subscriptionId: query.subscriptionId,
      status: query.status,
    });
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get an invoice",
    description: "Returns a single invoice by ID with line items.",
  })
  @ApiParam({ name: "id", description: "Invoice ID" })
  @ApiResponse({
    status: 200,
    description: "Invoice details with line items",
    type: InvoiceWithLineItemsSchema,
  })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async getInvoice(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const invoice = await this.invoicesService.findById(workspaceId, id);
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  @Get(":id/pdf")
  @ApiOperation({
    summary: "Get invoice PDF URL",
    description:
      "Returns a temporary download URL for the invoice PDF from the billing provider.",
  })
  @ApiParam({ name: "id", description: "Invoice ID" })
  @ApiResponse({
    status: 200,
    description: "PDF download URL",
    type: PdfUrlResponseSchema,
  })
  @ApiResponse({ status: 404, description: "Invoice not found or PDF not available" })
  async getInvoicePdf(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.getPdfUrl(workspaceId, id);
  }

  @Post(":id/void")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Void an invoice",
    description: `Voids an open or draft invoice. Cannot be undone.

**Requirements:**
- Invoice must be in \`draft\` or \`open\` status
- Requires admin role`,
  })
  @ApiParam({ name: "id", description: "Invoice ID" })
  @ApiResponse({
    status: 200,
    description: "Invoice voided",
    type: InvoiceSchema,
  })
  @ApiResponse({ status: 400, description: "Invoice cannot be voided" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async voidInvoice(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.voidInvoice(workspaceId, id);
  }

  @Post(":id/pay")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Pay an invoice",
    description: `Triggers a payment attempt for an open invoice.

**Note:** This triggers the payment in the billing provider. The actual status update will come via webhook.

**Requirements:**
- Invoice must be in \`open\` status
- Requires admin role`,
  })
  @ApiParam({ name: "id", description: "Invoice ID" })
  @ApiResponse({
    status: 200,
    description: "Payment triggered",
    type: InvoiceSchema,
  })
  @ApiResponse({ status: 400, description: "Invoice cannot be paid" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async payInvoice(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.payInvoice(workspaceId, id);
  }
}
