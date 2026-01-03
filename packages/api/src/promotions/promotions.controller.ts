import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { ETagInterceptor } from "../common/interceptors/etag.interceptor";
import { PromotionsService } from "./promotions.service";
import { WorkspaceId, AdminOnly, MemberOnly } from "../common/decorators";
import {
  CreatePromotionRequestDto,
  CreatePromotionVersionRequestDto,
  QueryPromotionsDto,
  PublishPromotionDto,
  UpdatePromotionDto,
  ValidatePromotionDto,
} from "./dto";
import { PromotionSchema, PaginationSchema } from "../common/schemas";

@ApiTags("promotions")
@ApiSecurity("api-key")
@Controller("promotions")
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: "List promotions",
    description: `Retrieves a paginated list of promotions in your workspace.

**Use this to:**
- Display active promotions in your admin dashboard
- Search for specific promotion codes
- Monitor promotion inventory and status

**Pagination:** Results are returned in pages of up to 100 items. Use the \`nextCursor\` from the response to fetch subsequent pages.

**Search:** The search parameter matches against both promotion codes and names, useful for finding promotions when you only remember part of the code or campaign name.`,
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated list of promotions with their current published version (if any).",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: PromotionSchema,
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
    @Query() query: QueryPromotionsDto,
  ) {
    return this.promotionsService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      status: query.status,
      search: query.search,
    });
  }

  @Get(":id")
  @MemberOnly()
  @ApiOperation({
    summary: "Get promotion details",
    description: `Retrieves complete details for a single promotion, including all versions.

**Use this to:**
- Display promotion configuration in your admin UI
- Check current and historical versions before making changes
- Review discount settings and restrictions

**Response includes:**
- Promotion metadata (code, name, description, status)
- All versions with their full configuration
- Currently published version reference

**Version lifecycle:**
- \`draft\`: Can be edited, not usable at checkout
- \`published\`: Active version applied when code is used
- \`archived\`: Previously published, preserved for audit trail`,
  })
  @ApiParam({
    name: "id",
    description: "Unique promotion identifier (UUID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Promotion with all versions",
    schema: PromotionSchema,
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
    description: "Promotion not found in this workspace",
  })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const promotion = await this.promotionsService.findById(workspaceId, id);
    if (!promotion) {
      throw new NotFoundException("Promotion not found");
    }
    return promotion;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: "Create promotion",
    description: `Creates a new promotion with an initial draft version (v1).

**Workflow:**
1. Create promotion with code and configuration -> Returns promotion with draft v1
2. Review the draft configuration
3. Call \`POST /promotions/{id}/publish\` to make it available for use

**Important:**
- The promotion code must be unique within your workspace
- The promotion cannot be used at checkout until published
- Use validFrom/validUntil in config to schedule promotions in advance

**Side effects:**
- Creates promotion record in database
- Creates version 1 in \`draft\` status
- Does NOT sync to billing provider until published

**Example use cases:**
- Percentage discount: \`{ discountType: "percent", discountValue: 25 }\`
- Fixed amount off: \`{ discountType: "fixed_amount", discountValue: 1000, currency: "USD" }\`
- Extended trial: \`{ discountType: "free_trial_days", discountValue: 14 }\``,
  })
  @ApiResponse({
    status: 201,
    description:
      "Promotion created with draft version 1. Publish to make available for checkouts.",
    schema: PromotionSchema,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid configuration or duplicate promotion code.",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreatePromotionRequestDto,
  ) {
    return this.promotionsService.create(workspaceId, dto);
  }

  @Patch(":id")
  @AdminOnly()
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: "Update promotion metadata",
    description: `Updates promotion-level metadata (name, description) without affecting versioned configuration.

**Use this for:**
- Correcting typos in promotion names
- Updating internal descriptions
- Changes that don't affect the discount itself

**This does NOT:**
- Change the promotion code (codes are immutable)
- Create a new version
- Affect discount values, restrictions, or validity (use versions for that)
- Require re-publishing

**Concurrency Control (Optimistic Locking):**
Include the \`If-Match\` header with the ETag from a previous GET to prevent concurrent modification conflicts.

Changes take effect immediately and are reflected in all API responses.`,
  })
  @ApiParam({
    name: "id",
    description: "Promotion ID to update",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiHeader({
    name: "If-Match",
    required: false,
    description:
      'ETag from a previous GET request for concurrency control. Format: W/"id-version"',
    example: 'W/"123e4567-e89b-12d3-a456-426614174000-1"',
  })
  @ApiResponse({
    status: 200,
    description: "Promotion metadata updated",
    headers: {
      ETag: {
        description: "New resource version after update",
        schema: { type: "string", example: 'W/"id-2"' },
      },
    },
    schema: PromotionSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({ status: 404, description: "Promotion not found" })
  @ApiResponse({
    status: 412,
    description:
      "Precondition Failed - Version mismatch, resource was modified",
  })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(workspaceId, id, dto);
  }

  @Post(":id/archive")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Archive promotion",
    description: `Archives a promotion, preventing it from being used in new checkouts.

**Use this when:**
- A promotion campaign has ended
- You want to disable a code without deleting it
- Cleaning up test promotions

**Side effects:**
- Sets promotion status to \`archived\`
- Promotion no longer appears in default listings
- Promotion code is rejected at checkout validation

**Does NOT affect:**
- Historical records of past redemptions
- Existing subscriptions with recurring discounts (they continue)
- Billing provider records (coupon remains but promotion code is deactivated)

**This is reversible** through direct status update, but prefer creating new promotions for new campaigns.`,
  })
  @ApiParam({
    name: "id",
    description: "Promotion ID to archive",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Promotion archived successfully",
    schema: PromotionSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({ status: 404, description: "Promotion not found" })
  async archive(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.promotionsService.archive(workspaceId, id);
  }

  @Get(":id/versions")
  @MemberOnly()
  @ApiOperation({
    summary: "List promotion versions",
    description: `Retrieves all versions of a promotion, ordered by version number (newest first).

**Use this to:**
- View version history
- Compare configurations across versions
- Audit discount changes over time

**Version statuses:**
- \`draft\`: Work in progress, editable, not synced to billing provider
- \`published\`: Currently active version used when code is redeemed
- \`archived\`: Previously published version, preserved for audit

Only one version can be \`published\` at a time. Each version contains the complete discount configuration at that point in time.`,
  })
  @ApiParam({
    name: "id",
    description: "Promotion ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "List of all versions with their configurations",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Promotion not found" })
  async getVersions(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.promotionsService.getVersions(workspaceId, id);
  }

  @Post(":id/versions")
  @AdminOnly()
  @ApiOperation({
    summary: "Create draft version",
    description: `Creates a new draft version for a promotion with updated configuration.

**Use this when:**
- Changing discount value or type
- Modifying redemption limits
- Adjusting validity dates
- Updating offer restrictions

**Workflow:**
1. Create new version with desired config -> Returns draft version
2. Review changes
3. Publish when ready -> New version becomes active

**Constraints:**
- Only one draft version can exist at a time
- Must publish or delete existing draft before creating another
- Existing discounts on active subscriptions are NOT affected

**Side effects:**
- Creates new version record in database
- Does NOT sync to billing provider until published`,
  })
  @ApiParam({
    name: "id",
    description: "Promotion ID to create version for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 201,
    description: "Draft version created. Call publish to make it active.",
  })
  @ApiResponse({
    status: 400,
    description: "A draft version already exists. Publish or delete it first.",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({ status: 404, description: "Promotion not found" })
  async createVersion(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreatePromotionVersionRequestDto,
  ) {
    return this.promotionsService.createVersion(workspaceId, id, dto.config);
  }

  @Post(":id/publish")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Publish version",
    description: `Publishes a draft version, making it the active version for new redemptions.

**What happens:**
1. Draft version status changes to \`published\`
2. Previously published version (if any) changes to \`archived\`
3. Configuration syncs to billing provider:
   - Creates or updates Stripe coupon with discount settings
   - Creates Stripe promotion code linked to the coupon
4. Promotion code becomes usable at checkout

**Side effects:**
- Syncs to Stripe: Creates coupon + promotion_code
- New checkouts with this code use the new discount settings
- Existing subscriptions with this promotion are NOT affected

**Failures:**
- Returns 404 if no draft version exists
- Returns 400 if trying to publish a non-draft version
- Billing provider sync failures are logged but don't prevent publishing

**Best practice:** Always test promotions in a test environment before publishing to production.`,
  })
  @ApiParam({
    name: "id",
    description: "Promotion ID to publish",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Version published and synced to billing provider",
    schema: PromotionSchema,
  })
  @ApiResponse({
    status: 400,
    description: "Only draft versions can be published",
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
    description: "Promotion not found or no draft version exists",
  })
  async publish(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PublishPromotionDto,
  ) {
    return this.promotionsService.publishVersion(
      workspaceId,
      id,
      dto.versionId,
    );
  }

  @Post("validate")
  @MemberOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Validate promotion code",
    description: `Validates a promotion code before applying it to a checkout, checking all applicable restrictions.

**Use this to:**
- Pre-validate codes in your checkout UI before creating a session
- Show customers whether their code is valid
- Display the discount amount before they complete checkout

**Validation checks performed:**
1. Code exists and is published
2. Promotion is not archived
3. Current date is within validFrom/validUntil range
4. Offer is in applicableOfferIds (if restricted)
5. Total redemptions haven't exceeded maxRedemptions
6. Customer hasn't exceeded maxRedemptionsPerCustomer (if customerId provided)
7. Order amount meets minimumAmount (if orderAmount provided)

**Response includes:**
- \`valid\`: Whether the code can be used
- \`promotion\`: Full promotion details if valid
- \`discountPreview\`: Calculated discount amount for the given order
- \`invalidReason\`: Explanation if validation failed

**Example usage:**
\`\`\`json
{
  "code": "SUMMER25",
  "offerId": "offer-uuid",
  "customerId": "customer-uuid",
  "orderAmount": 5000
}
\`\`\``,
  })
  @ApiResponse({
    status: 200,
    description: "Validation result with promotion details if valid",
    schema: {
      type: "object",
      properties: {
        valid: {
          type: "boolean",
          description: "Whether the promotion code is valid for this context",
        },
        promotion: {
          type: "object",
          nullable: true,
          description: "Promotion details if valid, null if invalid",
        },
        discountPreview: {
          type: "object",
          nullable: true,
          description: "Preview of the discount that would be applied",
          properties: {
            type: {
              type: "string",
              enum: ["percent", "fixed_amount", "free_trial_days"],
            },
            value: {
              type: "number",
              description: "Discount value (percentage, cents, or days)",
            },
            calculatedAmount: {
              type: "number",
              nullable: true,
              description:
                "Calculated discount in cents (for percent/fixed_amount)",
            },
          },
        },
        invalidReason: {
          type: "string",
          nullable: true,
          description: "Human-readable explanation if validation failed",
          example: "Promotion has reached maximum redemptions",
        },
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
  async validate(
    @WorkspaceId() workspaceId: string,
    @Body() dto: ValidatePromotionDto,
  ) {
    return this.promotionsService.validate(
      workspaceId,
      dto.code,
      dto.offerId,
      dto.customerId,
      dto.orderAmount,
    );
  }

  @Get(":id/usage")
  @MemberOnly()
  @ApiOperation({
    summary: "Get promotion usage statistics",
    description: `Retrieves redemption statistics for a promotion, useful for monitoring campaign performance.

**Use this to:**
- Monitor how many times a promotion has been used
- Track total discount value given
- Determine if you're approaching redemption limits

**Response includes:**
- \`redemptionCount\`: Total number of times the code was successfully applied
- \`totalDiscountAmount\`: Sum of all discounts applied (in smallest currency unit)

**Note:** Statistics are updated in near real-time as checkouts complete. For detailed redemption history, query the applied_promotions via database or webhook events.`,
  })
  @ApiParam({
    name: "id",
    description: "Promotion ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Usage statistics",
    schema: {
      type: "object",
      properties: {
        promotionId: { type: "string", format: "uuid" },
        redemptionCount: {
          type: "integer",
          description: "Total number of successful redemptions",
          example: 47,
        },
        totalDiscountAmount: {
          type: "integer",
          description:
            "Total discount value in smallest currency unit (e.g., cents)",
          example: 235000,
        },
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
  @ApiResponse({ status: 404, description: "Promotion not found" })
  async getUsage(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const promotion = await this.promotionsService.findById(workspaceId, id);
    if (!promotion) {
      throw new NotFoundException("Promotion not found");
    }

    const usage = await this.promotionsService.getAppliedPromotions(
      workspaceId,
      id,
    );

    return {
      promotionId: id,
      redemptionCount: usage.count,
      totalDiscountAmount: usage.totalDiscount,
    };
  }
}
