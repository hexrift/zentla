import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { WorkspaceId, AdminOnly, MemberOnly } from "../common/decorators";
import { SubscriptionSchema, PaginationSchema } from "../common/schemas";
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  Matches,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// QUERY DTOs
// ============================================================================

class QuerySubscriptionsDto {
  @ApiPropertyOptional({
    description: "Maximum number of subscriptions to return per page.",
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
      "Pagination cursor from a previous response. Pass `nextCursor` from the last response to fetch the next page.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description:
      "Filter subscriptions by customer ID. Returns only subscriptions belonging to this customer.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "customerId must be a valid UUID" })
  customerId?: string;

  @ApiPropertyOptional({
    description:
      "Filter subscriptions by offer ID. Returns only subscriptions using this offer.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "offerId must be a valid UUID" })
  offerId?: string;

  @ApiPropertyOptional({
    description: `Filter by subscription status:
- **active**: Subscription is current and billing normally
- **trialing**: Customer is in trial period, not yet billed
- **canceled**: Subscription has been canceled (may still be active until period end)
- **past_due**: Payment failed, subscription at risk
- **paused**: Subscription is temporarily paused`,
    enum: ["active", "trialing", "canceled", "past_due", "paused"],
    example: "active",
  })
  @IsOptional()
  @IsString()
  status?: "active" | "trialing" | "canceled" | "past_due" | "paused";
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: `When \`true\`, the subscription continues until the end of the current billing period, then cancels. When \`false\` (or omitted), cancels immediately.

**Use cases:**
- \`true\`: Standard cancellation - customer keeps access until they've paid for
- \`false\`: Immediate termination - for refunds or policy violations

**After cancellation:**
- Customer loses entitlements at the effective cancellation time
- A \`subscription.canceled\` webhook event is sent
- For immediate cancellation, prorated refund may be issued based on your Stripe settings`,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({
    description: `Optional reason for cancellation. Stored for analytics and may be shown in admin dashboards.

**Common reasons:**
- "Customer requested"
- "Switching to competitor"
- "Too expensive"
- "Missing features"
- "Account violation"`,
    example: "Customer requested - switching to annual plan",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

class ChangeSubscriptionDto {
  @ApiProperty({
    description: `The new offer ID to switch this subscription to. The offer must have a published version.

**Plan changes:**
- Customer's subscription moves to the new offer's pricing and entitlements
- Entitlements are updated immediately (old revoked, new granted)
- Billing adjusts based on \`prorationBehavior\``,
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @Matches(UUID_REGEX, { message: "newOfferId must be a valid UUID" })
  newOfferId!: string;

  @ApiPropertyOptional({
    description:
      "Specific version of the new offer to use. If omitted, uses the currently published version of the new offer.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "newOfferVersionId must be a valid UUID" })
  newOfferVersionId?: string;

  @ApiPropertyOptional({
    description: `How to handle billing when changing plans:

- **create_prorations** (default): Customer is credited for unused time on old plan and charged for new plan. Results in a prorated invoice.
- **none**: No proration. Customer continues on old billing until next renewal, then new price applies.
- **always_invoice**: Generate an invoice immediately for the price difference.

**Examples:**
- Upgrade mid-cycle with \`create_prorations\`: Customer pays difference immediately
- Downgrade with \`none\`: New lower price takes effect at next renewal`,
    enum: ["create_prorations", "none", "always_invoice"],
    default: "create_prorations",
  })
  @IsOptional()
  @IsEnum(["create_prorations", "none", "always_invoice"])
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("subscriptions")
@ApiSecurity("api-key")
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: "List subscriptions",
    description: `Retrieves a paginated list of subscriptions in your workspace.

**Use this to:**
- Display all subscriptions in your admin dashboard
- Find subscriptions for a specific customer
- Monitor subscriptions by status (active, trialing, canceled, etc.)
- Filter subscriptions by offer/plan

**Pagination:** Results are returned in pages of up to 100 items. Use the \`nextCursor\` from the response to fetch subsequent pages.

**Filtering:** Combine filters to narrow results. For example, find all active subscriptions for a specific customer:
\`?customerId=uuid&status=active\``,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of subscriptions",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: SubscriptionSchema,
        },
        ...PaginationSchema.properties,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QuerySubscriptionsDto
  ) {
    return this.subscriptionsService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      customerId: query.customerId,
      offerId: query.offerId,
      status: query.status,
    });
  }

  @Get(":id")
  @MemberOnly()
  @ApiOperation({
    summary: "Get subscription details",
    description: `Retrieves complete details for a single subscription.

**Use this to:**
- Display subscription details in customer portal
- Check subscription status and entitlements
- Get billing period information
- View applied promotions

**Response includes:**
- Current status and billing period
- Associated customer and offer
- Active entitlements granted by this subscription
- Promotion/discount information if applicable
- Cancellation details if scheduled or completed`,
  })
  @ApiParam({
    name: "id",
    description: "Subscription ID (UUID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Subscription details",
    schema: SubscriptionSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({
    status: 404,
    description: "Subscription not found in this workspace",
  })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    const subscription = await this.subscriptionsService.findById(
      workspaceId,
      id
    );
    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return subscription;
  }

  @Post(":id/cancel")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cancel subscription",
    description: `Cancels a subscription, either immediately or at the end of the current billing period.

**Cancellation modes:**

1. **Cancel at period end** (\`cancelAtPeriodEnd: true\`):
   - Subscription remains active until \`currentPeriodEnd\`
   - Customer retains entitlements until then
   - No refund issued (customer has paid for this period)
   - Status changes to \`canceled\` at period end

2. **Cancel immediately** (\`cancelAtPeriodEnd: false\` or omitted):
   - Subscription ends immediately
   - Entitlements are revoked right away
   - Prorated refund may be issued (per Stripe settings)
   - Status changes to \`canceled\` immediately

**Side effects:**
- Updates subscription status
- Revokes entitlements (immediately or at period end)
- Syncs cancellation to Stripe
- Sends \`subscription.canceled\` webhook event

**Note:** Canceled subscriptions cannot be reactivated. To resume service, create a new subscription.`,
  })
  @ApiParam({
    name: "id",
    description: "Subscription ID to cancel",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Subscription canceled (or scheduled for cancellation)",
    schema: SubscriptionSchema,
  })
  @ApiResponse({
    status: 400,
    description: "Subscription already canceled or in invalid state",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({
    status: 404,
    description: "Subscription not found",
  })
  async cancel(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto
  ) {
    return this.subscriptionsService.cancel(workspaceId, id, dto);
  }

  @Post(":id/change")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Change subscription plan",
    description: `Changes a subscription to a different offer (upgrade, downgrade, or lateral move).

**Use this to:**
- Upgrade customers to higher-tier plans
- Downgrade to lower-tier plans
- Switch between plans with different billing intervals (monthly to annual)

**What happens:**
1. Subscription moves to the new offer and version
2. Entitlements update immediately (old removed, new granted)
3. Billing adjusts based on \`prorationBehavior\`
4. Stripe subscription is updated

**Proration options:**
- \`create_prorations\`: Credit for unused time + charge for new plan
- \`none\`: No immediate billing change, new price at next renewal
- \`always_invoice\`: Generate invoice immediately

**Example - Upgrade:**
Customer on $29/mo plan upgrades to $99/mo mid-cycle.
With \`create_prorations\`: They're credited ~$15 (unused days) and charged ~$50 (remaining days at new rate).

**Example - Downgrade:**
Customer on $99/mo downgrades to $29/mo.
With \`none\`: They keep $99 plan until renewal, then switch to $29.

**Side effects:**
- Updates subscription record with new offer
- Revokes old entitlements, grants new ones
- Syncs to Stripe
- Sends \`subscription.updated\` webhook event`,
  })
  @ApiParam({
    name: "id",
    description: "Subscription ID to change",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Subscription plan changed successfully",
    schema: SubscriptionSchema,
  })
  @ApiResponse({
    status: 400,
    description: `Invalid request. Common causes:
- Subscription is canceled or in invalid state for changes
- New offer has no published version
- Proration calculation failed`,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({
    status: 404,
    description: "Subscription or new offer not found",
  })
  async change(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionDto
  ) {
    return this.subscriptionsService.change(workspaceId, id, dto);
  }
}
