import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
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
import type { DunningFinalAction, DunningEmailType } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsArray,
  IsEmail,
  Max,
  Min,
  ArrayMinSize,
} from "class-validator";
import { MemberOnly, AdminOnly, WorkspaceId } from "../common/decorators";
import { DunningService } from "./dunning.service";
import { DunningConfigService } from "./dunning-config.service";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class QueryInvoicesInDunningDto {
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
}

class UpdateDunningConfigDto {
  @ApiPropertyOptional({
    description:
      "Retry schedule as days after first failure (e.g., [1, 3, 5, 7])",
    type: [Number],
    example: [1, 3, 5, 7],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  retrySchedule?: number[];

  @ApiPropertyOptional({
    description: "Maximum number of retry attempts",
    minimum: 1,
    maximum: 10,
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: "Action to take after all retries fail",
    enum: ["suspend", "cancel"],
    example: "suspend",
  })
  @IsOptional()
  @IsEnum(["suspend", "cancel"])
  finalAction?: DunningFinalAction;

  @ApiPropertyOptional({
    description:
      "Grace period in days after last failed attempt before final action",
    minimum: 0,
    maximum: 30,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  gracePeriodDays?: number;

  @ApiPropertyOptional({
    description: "Whether to send dunning emails to customers",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  emailsEnabled?: boolean;

  @ApiPropertyOptional({
    description: "From email address for dunning emails",
    example: "billing@yourcompany.com",
  })
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @ApiPropertyOptional({
    description: "From name for dunning emails",
    example: "Billing Team",
  })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional({
    description: "Reply-to email address for dunning emails",
    example: "support@yourcompany.com",
  })
  @IsOptional()
  @IsEmail()
  replyToEmail?: string;
}

class StopDunningDto {
  @ApiProperty({
    description: "Reason for stopping dunning",
    example: "Customer contacted support",
  })
  @IsString()
  reason!: string;
}

const EMAIL_TYPE_ENUM = [
  "payment_failed",
  "payment_reminder",
  "final_warning",
  "subscription_suspended",
  "subscription_canceled",
  "payment_recovered",
] as const;

class UpdateEmailTemplateDto {
  @ApiPropertyOptional({
    description: "Email subject line (supports {{variables}})",
    example: "Payment Failed for Invoice {{invoiceNumber}}",
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: "HTML email body (supports {{variables}} and {{#if var}}...{{/if}})",
  })
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional({
    description: "Plain text email body",
  })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({
    description: "Whether this email type is enabled",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

class DunningConfigSchema {
  @ApiProperty({ description: "Config ID" })
  id!: string;

  @ApiProperty({ description: "Workspace ID" })
  workspaceId!: string;

  @ApiProperty({
    description: "Retry schedule as days after first failure",
    type: [Number],
    example: [1, 3, 5, 7],
  })
  retrySchedule!: number[];

  @ApiProperty({ description: "Maximum retry attempts" })
  maxAttempts!: number;

  @ApiProperty({
    description: "Action after all retries fail",
    enum: ["suspend", "cancel"],
  })
  finalAction!: string;

  @ApiProperty({ description: "Grace period in days before final action" })
  gracePeriodDays!: number;

  @ApiProperty({ description: "Whether dunning emails are enabled" })
  emailsEnabled!: boolean;

  @ApiPropertyOptional({ description: "From email for dunning emails" })
  fromEmail?: string;

  @ApiPropertyOptional({ description: "From name for dunning emails" })
  fromName?: string;

  @ApiPropertyOptional({ description: "Reply-to email for dunning emails" })
  replyToEmail?: string;

  @ApiProperty({ description: "Whether using default config" })
  isDefault!: boolean;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt!: string;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt!: string;
}

class DunningCustomerSchema {
  @ApiProperty({ description: "Customer ID" })
  id!: string;

  @ApiProperty({ description: "Customer email" })
  email!: string;

  @ApiPropertyOptional({ description: "Customer name" })
  name?: string;
}

class DunningInvoiceSchema {
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

  @ApiProperty({ description: "Currency code" })
  currency!: string;

  @ApiProperty({ description: "Invoice status" })
  status!: string;

  @ApiProperty({ description: "When dunning started" })
  dunningStartedAt!: string;

  @ApiProperty({ description: "Current attempt count" })
  dunningAttemptCount!: number;

  @ApiPropertyOptional({ description: "Next retry scheduled at" })
  nextDunningAttemptAt?: string;

  @ApiProperty({ description: "Customer details", type: DunningCustomerSchema })
  customer!: DunningCustomerSchema;
}

class AmountByCurrencySchema {
  @ApiProperty({ description: "Currency code (lowercase)", example: "usd" })
  currency!: string;

  @ApiProperty({ description: "Amount in cents", example: 10000 })
  amount!: number;
}

class DunningStatsSchema {
  @ApiProperty({ description: "Number of invoices currently in dunning" })
  invoicesInDunning!: number;

  @ApiProperty({ description: "Total amount at risk in cents (sum across all currencies)" })
  totalAmountAtRisk!: number;

  @ApiProperty({
    description: "Primary currency code (deprecated, use amountsByCurrency)",
    deprecated: true,
  })
  currency!: string;

  @ApiProperty({
    description: "Amounts at risk grouped by currency",
    type: [AmountByCurrencySchema],
    example: [{ currency: "usd", amount: 10000 }, { currency: "eur", amount: 5000 }],
  })
  amountsByCurrency!: AmountByCurrencySchema[];

  @ApiProperty({ description: "Payment recovery rate percentage" })
  recoveryRate!: number;

  @ApiProperty({
    description: "Attempts grouped by status",
    example: { pending: 5, succeeded: 10, failed: 3 },
  })
  attemptsByStatus!: {
    pending: number;
    succeeded: number;
    failed: number;
  };
}

class ManualRetryResultSchema {
  @ApiProperty({ description: "Attempt ID" })
  attemptId!: string;

  @ApiProperty({ description: "Whether payment succeeded" })
  success!: boolean;

  @ApiPropertyOptional({ description: "Failure reason if unsuccessful" })
  failureReason?: string;

  @ApiPropertyOptional({ description: "Decline code from payment provider" })
  declineCode?: string;
}

class EmailTemplateSchema {
  @ApiProperty({
    description: "Email type",
    enum: EMAIL_TYPE_ENUM,
  })
  type!: string;

  @ApiProperty({ description: "Email subject line" })
  subject!: string;

  @ApiProperty({ description: "HTML email body" })
  bodyHtml!: string;

  @ApiPropertyOptional({ description: "Plain text email body" })
  bodyText?: string;

  @ApiProperty({ description: "Whether this email type is enabled" })
  enabled!: boolean;

  @ApiProperty({ description: "Whether using the default template" })
  isDefault!: boolean;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("dunning")
@ApiSecurity("api-key")
@Controller("dunning")
@MemberOnly()
export class DunningController {
  constructor(
    private readonly dunningService: DunningService,
    private readonly dunningConfigService: DunningConfigService,
  ) {}

  @Get("config")
  @ApiOperation({
    summary: "Get dunning configuration",
    description: `Returns the dunning configuration for the workspace.

If no configuration has been set, returns default values with \`isDefault: true\`.

**Default values:**
- \`retrySchedule\`: [1, 3, 5, 7] (days after first failure)
- \`maxAttempts\`: 4
- \`finalAction\`: suspend
- \`gracePeriodDays\`: 0
- \`emailsEnabled\`: false`,
  })
  @ApiResponse({
    status: 200,
    description: "Dunning configuration",
    type: DunningConfigSchema,
  })
  async getConfig(@WorkspaceId() workspaceId: string) {
    return this.dunningConfigService.getConfig(workspaceId);
  }

  @Put("config")
  @AdminOnly()
  @ApiOperation({
    summary: "Update dunning configuration",
    description: `Updates the dunning configuration for the workspace.

**Retry Schedule:**
The retry schedule is an array of days after the first payment failure when retries should occur.
For example, [1, 3, 5, 7] means retry 1 day, 3 days, 5 days, and 7 days after the initial failure.

**Final Action:**
- \`suspend\`: Pause the subscription (can be reactivated)
- \`cancel\`: Permanently cancel the subscription

**Email Notifications:**
When \`emailsEnabled\` is true, customers will receive email notifications about payment failures and recovery.
Requires \`fromEmail\` to be set.`,
  })
  @ApiResponse({
    status: 200,
    description: "Updated dunning configuration",
    type: DunningConfigSchema,
  })
  async updateConfig(
    @WorkspaceId() workspaceId: string,
    @Body() body: UpdateDunningConfigDto,
  ) {
    const config = await this.dunningConfigService.upsertConfig(workspaceId, {
      retrySchedule: body.retrySchedule,
      maxAttempts: body.maxAttempts,
      finalAction: body.finalAction,
      gracePeriodDays: body.gracePeriodDays,
      emailsEnabled: body.emailsEnabled,
      fromEmail: body.fromEmail,
      fromName: body.fromName,
      replyToEmail: body.replyToEmail,
    });

    return { ...config, isDefault: false };
  }

  @Get("invoices")
  @ApiOperation({
    summary: "List invoices in dunning",
    description: `Returns invoices currently in the dunning process.

These are invoices with failed payments that are actively being retried.
Use cursor-based pagination for large result sets.`,
  })
  @ApiResponse({
    status: 200,
    description: "List of invoices in dunning",
    type: [DunningInvoiceSchema],
  })
  async listInvoicesInDunning(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryInvoicesInDunningDto,
  ) {
    return this.dunningService.getInvoicesInDunning(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
    });
  }

  @Get("stats")
  @ApiOperation({
    summary: "Get dunning statistics",
    description: `Returns dunning statistics for the workspace dashboard.

Includes:
- Number of invoices currently in dunning
- Total amount at risk
- Recovery rate percentage
- Attempts grouped by status`,
  })
  @ApiResponse({
    status: 200,
    description: "Dunning statistics",
    type: DunningStatsSchema,
  })
  async getStats(@WorkspaceId() workspaceId: string) {
    return this.dunningService.getDunningStats(workspaceId);
  }

  @Post("invoices/:id/retry")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Trigger manual payment retry",
    description: `Triggers an immediate payment retry for an invoice.

This bypasses the scheduled retry and attempts payment immediately.
Useful when a customer updates their payment method.`,
  })
  @ApiParam({ name: "id", description: "Invoice ID" })
  @ApiResponse({
    status: 200,
    description: "Retry result",
    type: ManualRetryResultSchema,
  })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async triggerManualRetry(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.dunningService.triggerManualRetry(workspaceId, invoiceId);
  }

  @Post("invoices/:id/stop")
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Stop dunning for an invoice",
    description: `Stops the dunning process for a specific invoice.

This cancels all pending retry attempts and marks dunning as ended.
The invoice will remain unpaid but no further automatic retries will be attempted.`,
  })
  @ApiParam({ name: "id", description: "Invoice ID" })
  @ApiResponse({ status: 204, description: "Dunning stopped" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async stopDunning(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) invoiceId: string,
    @Body() body: StopDunningDto,
  ) {
    await this.dunningService.stopDunning(workspaceId, invoiceId, body.reason);
  }

  // ============================================================================
  // EMAIL TEMPLATE ENDPOINTS
  // ============================================================================

  @Get("email-templates")
  @ApiOperation({
    summary: "List all email templates",
    description: `Returns all dunning email templates for the workspace.

Each template shows whether it's using default content or has been customized.

**Template Types:**
- \`payment_failed\`: Sent when initial payment fails
- \`payment_reminder\`: Sent on subsequent retry attempts
- \`final_warning\`: Sent before final retry
- \`subscription_suspended\`: Sent when subscription is suspended
- \`subscription_canceled\`: Sent when subscription is canceled
- \`payment_recovered\`: Sent when payment succeeds after failures

**Available Variables:**
- \`{{customerName}}\`: Customer's name
- \`{{customerEmail}}\`: Customer's email
- \`{{invoiceAmount}}\`: Formatted amount
- \`{{invoiceCurrency}}\`: Currency code
- \`{{invoiceNumber}}\`: Invoice ID
- \`{{attemptNumber}}\`: Current retry attempt
- \`{{maxAttempts}}\`: Maximum attempts configured
- \`{{nextRetryDate}}\`: Next scheduled retry
- \`{{updatePaymentUrl}}\`: Link to update payment method
- \`{{companyName}}\`: Your company name
- \`{{supportEmail}}\`: Support email address

**Conditional Blocks:**
Use \`{{#if variable}}content{{/if}}\` for conditional content.`,
  })
  @ApiResponse({
    status: 200,
    description: "List of email templates",
    type: [EmailTemplateSchema],
  })
  async listEmailTemplates(@WorkspaceId() workspaceId: string) {
    return this.dunningConfigService.getEmailTemplates(workspaceId);
  }

  @Get("email-templates/:type")
  @ApiOperation({
    summary: "Get an email template",
    description: "Returns a specific dunning email template by type.",
  })
  @ApiParam({
    name: "type",
    description: "Email template type",
    enum: EMAIL_TYPE_ENUM,
  })
  @ApiResponse({
    status: 200,
    description: "Email template",
    type: EmailTemplateSchema,
  })
  async getEmailTemplate(
    @WorkspaceId() workspaceId: string,
    @Param("type") type: DunningEmailType,
  ) {
    return this.dunningConfigService.getEmailTemplate(workspaceId, type);
  }

  @Put("email-templates/:type")
  @AdminOnly()
  @ApiOperation({
    summary: "Update an email template",
    description: `Updates a dunning email template.

Provide only the fields you want to change. Omitted fields will keep their current values.

See GET /dunning/email-templates for available variables and template syntax.`,
  })
  @ApiParam({
    name: "type",
    description: "Email template type",
    enum: EMAIL_TYPE_ENUM,
  })
  @ApiResponse({
    status: 200,
    description: "Updated email template",
    type: EmailTemplateSchema,
  })
  async updateEmailTemplate(
    @WorkspaceId() workspaceId: string,
    @Param("type") type: DunningEmailType,
    @Body() body: UpdateEmailTemplateDto,
  ) {
    return this.dunningConfigService.updateEmailTemplate(workspaceId, type, body);
  }

  @Delete("email-templates/:type")
  @AdminOnly()
  @ApiOperation({
    summary: "Reset email template to default",
    description: "Deletes custom template and reverts to the default template.",
  })
  @ApiParam({
    name: "type",
    description: "Email template type",
    enum: EMAIL_TYPE_ENUM,
  })
  @ApiResponse({
    status: 200,
    description: "Default email template",
    type: EmailTemplateSchema,
  })
  async resetEmailTemplate(
    @WorkspaceId() workspaceId: string,
    @Param("type") type: DunningEmailType,
  ) {
    return this.dunningConfigService.resetEmailTemplate(workspaceId, type);
  }
}
