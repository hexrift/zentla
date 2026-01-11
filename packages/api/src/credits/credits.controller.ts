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
import { MemberOnly, AdminOnly, WorkspaceId } from "../common/decorators";
import { CreditsService } from "./credits.service";
import {
  CreateCreditDto,
  QueryCreditsDto,
  ApplyCreditDto,
  VoidCreditDto,
} from "./dto";

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

class CreditCustomerSchema {
  @ApiProperty({ description: "Customer ID" })
  id!: string;

  @ApiProperty({ description: "Customer email" })
  email!: string;

  @ApiPropertyOptional({ description: "Customer name" })
  name?: string;
}

class CreditSchema {
  @ApiProperty({ description: "Credit ID" })
  id!: string;

  @ApiProperty({ description: "Workspace ID" })
  workspaceId!: string;

  @ApiProperty({ description: "Customer ID" })
  customerId!: string;

  @ApiProperty({ description: "Original credit amount in cents" })
  amount!: number;

  @ApiProperty({ description: "Remaining balance in cents" })
  balance!: number;

  @ApiProperty({ description: "Currency code" })
  currency!: string;

  @ApiProperty({
    description: "Credit status",
    enum: ["active", "depleted", "expired", "voided"],
  })
  status!: string;

  @ApiPropertyOptional({
    description: "Reason for credit",
    enum: [
      "promotional",
      "refund_alternative",
      "goodwill",
      "billing_error",
      "service_credit",
      "other",
    ],
  })
  reason?: string;

  @ApiPropertyOptional({ description: "Description" })
  description?: string;

  @ApiPropertyOptional({ description: "Expiration date" })
  expiresAt?: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt!: string;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt!: string;
}

class CreditWithRelationsSchema extends CreditSchema {
  @ApiProperty({ description: "Customer details", type: CreditCustomerSchema })
  customer!: CreditCustomerSchema;
}

class CreditBalanceSchema {
  @ApiProperty({ description: "Customer ID" })
  customerId!: string;

  @ApiProperty({ description: "Total balance in cents" })
  totalBalance!: number;

  @ApiProperty({ description: "Currency code" })
  currency!: string;

  @ApiProperty({ description: "Number of active credits" })
  activeCredits!: number;
}

class CreditTransactionSchema {
  @ApiProperty({ description: "Transaction ID" })
  id!: string;

  @ApiProperty({ description: "Credit ID" })
  creditId!: string;

  @ApiProperty({ description: "Customer ID" })
  customerId!: string;

  @ApiPropertyOptional({ description: "Invoice ID if applied to invoice" })
  invoiceId?: string;

  @ApiProperty({
    description: "Transaction type",
    enum: ["issued", "applied", "expired", "voided", "adjusted"],
  })
  type!: string;

  @ApiProperty({ description: "Transaction amount in cents" })
  amount!: number;

  @ApiProperty({ description: "Balance before transaction" })
  balanceBefore!: number;

  @ApiProperty({ description: "Balance after transaction" })
  balanceAfter!: number;

  @ApiPropertyOptional({ description: "Description" })
  description?: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt!: string;
}

class CreditApplicationSchema {
  @ApiProperty({ description: "Invoice ID" })
  invoiceId!: string;

  @ApiProperty({ description: "Total amount applied in cents" })
  totalApplied!: number;

  @ApiProperty({ description: "Credits used" })
  creditsUsed!: Array<{ creditId: string; amountApplied: number }>;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("credits")
@ApiSecurity("api-key")
@Controller("credits")
@MemberOnly()
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  @ApiOperation({
    summary: "List credits",
    description: `Returns all credits for the workspace with optional filtering.

**Statuses:**
- \`active\`: Credit has remaining balance
- \`depleted\`: Credit balance is zero (fully used)
- \`expired\`: Credit has passed expiration date
- \`voided\`: Credit was manually voided`,
  })
  @ApiResponse({
    status: 200,
    description: "List of credits",
    type: [CreditSchema],
  })
  async listCredits(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryCreditsDto,
  ) {
    return this.creditsService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      customerId: query.customerId,
      status: query.status as "active" | "depleted" | "expired" | "voided",
    });
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a credit",
    description:
      "Returns a single credit by ID with customer details and recent transactions.",
  })
  @ApiParam({ name: "id", description: "Credit ID" })
  @ApiResponse({
    status: 200,
    description: "Credit details",
    type: CreditWithRelationsSchema,
  })
  @ApiResponse({ status: 404, description: "Credit not found" })
  async getCredit(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const credit = await this.creditsService.findById(workspaceId, id);
    if (!credit) {
      throw new NotFoundException("Credit not found");
    }
    return credit;
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Issue a credit",
    description: `Issues a new credit to a customer.

**Reasons:**
- \`promotional\`: Promotional credit or discount
- \`refund_alternative\`: Credit issued instead of refund
- \`goodwill\`: Goodwill gesture for customer satisfaction
- \`billing_error\`: Correction for billing mistake
- \`service_credit\`: Credit for service issues
- \`other\`: Other reason

Requires admin role.`,
  })
  @ApiResponse({
    status: 201,
    description: "Credit issued",
    type: CreditSchema,
  })
  @ApiResponse({ status: 400, description: "Invalid credit request" })
  @ApiResponse({ status: 404, description: "Customer not found" })
  async issueCredit(
    @WorkspaceId() workspaceId: string,
    @Body() body: CreateCreditDto,
  ) {
    return this.creditsService.issueCredit(workspaceId, {
      customerId: body.customerId,
      amount: body.amount,
      currency: body.currency,
      reason: body.reason as
        | "promotional"
        | "refund_alternative"
        | "goodwill"
        | "billing_error"
        | "service_credit"
        | "other"
        | undefined,
      description: body.description,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Post(":id/void")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Void a credit",
    description: `Voids an active credit, setting its balance to zero.

Only active credits can be voided. Requires admin role.`,
  })
  @ApiParam({ name: "id", description: "Credit ID" })
  @ApiResponse({
    status: 200,
    description: "Credit voided",
    type: CreditSchema,
  })
  @ApiResponse({ status: 400, description: "Credit cannot be voided" })
  @ApiResponse({ status: 404, description: "Credit not found" })
  async voidCredit(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: VoidCreditDto,
  ) {
    return this.creditsService.voidCredit(workspaceId, id, body.reason);
  }

  @Get("balance/:customerId")
  @ApiOperation({
    summary: "Get customer credit balance",
    description: `Returns the total credit balance for a customer, grouped by currency.

Only includes active, non-expired credits.`,
  })
  @ApiParam({ name: "customerId", description: "Customer ID" })
  @ApiResponse({
    status: 200,
    description: "Customer credit balance by currency",
    type: [CreditBalanceSchema],
  })
  async getCustomerBalance(
    @WorkspaceId() workspaceId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.creditsService.getCustomerBalance(workspaceId, customerId);
  }

  @Post("apply")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Apply credits to invoice",
    description: `Applies available credits to an invoice.

**Behavior:**
- Uses FIFO (oldest credits first)
- Only applies credits matching the invoice currency
- Supports partial application with maxAmount parameter
- Invoice must be in \`open\` status

Requires admin role.`,
  })
  @ApiResponse({
    status: 200,
    description: "Credits applied",
    type: CreditApplicationSchema,
  })
  @ApiResponse({
    status: 204,
    description: "No credits available to apply",
  })
  @ApiResponse({ status: 400, description: "Invoice cannot receive credits" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async applyCredits(
    @WorkspaceId() workspaceId: string,
    @Body() body: ApplyCreditDto,
  ) {
    const result = await this.creditsService.applyToInvoice(
      workspaceId,
      body.invoiceId,
      body.maxAmount,
    );
    if (!result) {
      return { message: "No credits available to apply" };
    }
    return result;
  }

  @Get(":id/transactions")
  @ApiOperation({
    summary: "Get credit transactions",
    description: "Returns the transaction history for a specific credit.",
  })
  @ApiParam({ name: "id", description: "Credit ID" })
  @ApiResponse({
    status: 200,
    description: "List of transactions",
    type: [CreditTransactionSchema],
  })
  @ApiResponse({ status: 404, description: "Credit not found" })
  async getCreditTransactions(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.creditsService.getTransactions(workspaceId, id);
  }
}
