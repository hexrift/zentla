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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from "@nestjs/swagger";
import { OffersService } from "./offers.service";
import { WorkspaceId, AdminOnly, MemberOnly } from "../common/decorators";
import {
  CreateOfferRequestDto,
  CreateVersionRequestDto,
  QueryOffersDto,
  PublishOfferDto,
  RollbackOfferDto,
  UpdateOfferDto,
} from "./dto";
import {
  OfferSchema,
  OfferVersionSchema,
  PaginationSchema,
} from "../common/schemas";

@ApiTags("offers")
@ApiSecurity("api-key")
@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: "List offers",
    description: `Retrieves a paginated list of offers in your workspace.

**Use this to:**
- Display available plans in your pricing page
- Build offer selection UI in your admin dashboard
- Search for specific offers by name

**Pagination:** Results are returned in pages of up to 100 items. Use the \`nextCursor\` from the response to fetch subsequent pages.

**Filtering:** Use \`status=active\` to only show offers available for new subscriptions. Archived offers are hidden from this list by default but can be retrieved explicitly.`,
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated list of offers with their current published version (if any).",
    schema: {
      type: "object",
      properties: {
        data: { type: "array", items: OfferSchema },
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
    @Query() query: QueryOffersDto,
  ) {
    return this.offersService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      status: query.status,
      search: query.search,
    });
  }

  @Get(":id")
  @MemberOnly()
  @ApiOperation({
    summary: "Get offer details",
    description: `Retrieves complete details for a single offer, including all versions.

**Use this to:**
- Display offer configuration in your admin UI
- Check current and historical versions before making changes
- Verify offer setup before creating checkout sessions

**Response includes:**
- Offer metadata (name, description, status)
- All versions with their full configuration
- Currently published version reference

**Version lifecycle:**
- \`draft\`: Can be edited, not usable for checkouts
- \`published\`: Active version used for new subscriptions
- \`archived\`: Previously published, preserved for existing subscribers`,
  })
  @ApiParam({
    name: "id",
    description: "Unique offer identifier (UUID)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Offer with all versions",
    schema: OfferSchema,
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
    description: "Offer not found in this workspace",
  })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const offer = await this.offersService.findById(workspaceId, id);
    if (!offer) {
      throw new NotFoundException("Offer not found");
    }
    return offer;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: "Create offer",
    description: `Creates a new offer with an initial draft version (v1).

**Workflow:**
1. Create offer with desired configuration → Returns offer with draft v1
2. Review the draft configuration
3. Call \`POST /offers/{id}/publish\` to make it available for checkouts

**Side effects:**
- Creates offer record in database
- Creates version 1 in \`draft\` status
- Does NOT sync to billing provider until published

**The offer cannot be used for checkouts until published.** New subscribers always use the currently published version.

**Entitlements:** Features defined in \`config.entitlements\` will be provisioned to customers when their subscription becomes active.`,
  })
  @ApiResponse({
    status: 201,
    description:
      "Offer created with draft version 1. Publish to make available for checkouts.",
    schema: OfferSchema,
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid configuration. Check that pricing model matches provided fields.",
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
    @Body() dto: CreateOfferRequestDto,
  ) {
    return this.offersService.create(workspaceId, dto);
  }

  @Patch(":id")
  @AdminOnly()
  @ApiOperation({
    summary: "Update offer metadata",
    description: `Updates offer-level metadata (name, description) without affecting versioned configuration.

**Use this for:**
- Correcting typos in offer names
- Updating marketing descriptions
- Changes that don't affect pricing or entitlements

**This does NOT:**
- Create a new version
- Affect pricing, trials, or entitlements (use versions for that)
- Require re-publishing

Changes take effect immediately and are reflected in all API responses.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID to update",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Offer metadata updated",
    schema: OfferSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offersService.update(workspaceId, id, dto);
  }

  @Post(":id/sync")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sync offer to Stripe",
    description:
      "Manually sync a published offer to Stripe. Use this to retry if the initial sync failed.",
  })
  @ApiResponse({ status: 200, description: "Offer synced successfully" })
  @ApiResponse({
    status: 400,
    description: "No published version or Stripe not configured",
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async syncToStripe(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.offersService.syncOfferToStripe(workspaceId, id);
  }

  @Post(":id/archive")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Archive offer",
    description: `Archives an offer, hiding it from listings and preventing new subscriptions.

**Use this when:**
- Discontinuing a plan
- Replacing an offer with a new one
- Cleaning up test offers

**Side effects:**
- Sets offer status to \`archived\`
- Offer no longer appears in default listings
- Cannot be used for new checkout sessions

**Does NOT affect:**
- Existing subscriptions (they continue normally)
- Historical data (offer remains queryable by ID)
- Billing provider records

**This is reversible** by updating the offer status, but prefer creating new offers for major changes.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID to archive",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Offer archived successfully",
    schema: OfferSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async archive(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.offersService.archive(workspaceId, id);
  }

  @Get(":id/versions")
  @MemberOnly()
  @ApiOperation({
    summary: "List offer versions",
    description: `Retrieves all versions of an offer, ordered by version number (newest first).

**Use this to:**
- View version history
- Compare configurations across versions
- Find a previous version for rollback

**Version statuses:**
- \`draft\`: Work in progress, editable, not synced to billing provider
- \`published\`: Currently active version for new subscriptions
- \`archived\`: Previously published version, preserved for existing subscribers

Only one version can be \`published\` at a time.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "List of all versions with their configurations",
    schema: {
      type: "array",
      items: OfferVersionSchema,
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
  @ApiResponse({ status: 404, description: "Offer not found" })
  async getVersions(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.offersService.getVersions(workspaceId, id);
  }

  @Post(":id/versions")
  @AdminOnly()
  @ApiOperation({
    summary: "Create draft version",
    description: `Creates a new draft version for an offer with updated configuration.

**Use this when:**
- Changing pricing (amount, model, tiers)
- Modifying trial settings
- Adding or removing entitlements

**Workflow:**
1. Create new version with desired config → Returns draft version
2. Review changes
3. Publish when ready → New version becomes active

**Constraints:**
- Only one draft version can exist at a time
- Must publish or delete existing draft before creating another
- Existing subscribers are NOT affected until they change plans

**Side effects:**
- Creates new version record in database
- Does NOT sync to billing provider until published`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID to create version for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 201,
    description: "Draft version created. Call publish to make it active.",
    schema: OfferVersionSchema,
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
  @ApiResponse({ status: 404, description: "Offer not found" })
  async createVersion(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionRequestDto,
  ) {
    return this.offersService.createVersion(workspaceId, id, dto.config);
  }

  @Patch(":id/versions/draft")
  @AdminOnly()
  @ApiOperation({
    summary: "Update draft version",
    description: `Updates the existing draft version with new configuration, or creates one if none exists.

**Use this when:**
- Iterating on pricing or entitlements before publishing
- Making incremental changes to a draft

**This is idempotent:** Call it multiple times with different configs; only the latest config is saved.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Draft version updated or created",
    schema: OfferVersionSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions (requires admin role)",
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async updateDraftVersion(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionRequestDto,
  ) {
    return this.offersService.createOrUpdateDraftVersion(
      workspaceId,
      id,
      dto.config,
    );
  }

  @Post(":id/publish")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Publish version",
    description: `Publishes a draft version, making it active for new subscriptions (immediately or at a scheduled time).

**Immediate publish (default):**
1. Draft version status changes to \`published\`
2. Previously published version (if any) changes to \`archived\`
3. Configuration syncs to billing provider (creates/updates Stripe Product and Price)
4. Offer becomes available for checkout sessions immediately

**Scheduled publish (with effectiveFrom):**
1. Draft version status changes to \`published\`
2. Current version remains active until effectiveFrom date
3. Configuration syncs to billing provider immediately
4. Version automatically becomes effective at the scheduled time

**Side effects:**
- Syncs to Stripe: Creates Product (first publish) or reuses existing, creates new Price
- For scheduled publishes, both old and new prices exist in Stripe
- Existing subscriptions are NOT affected

**Failures:**
- Returns 404 if no draft version exists
- Billing provider sync failures are logged but don't prevent publishing

**Best practice:** Always test offers in a test environment before publishing to production.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID to publish",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description:
      "Version published (immediately or scheduled) and synced to billing provider",
    schema: OfferSchema,
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
    description: "Offer not found or no draft version exists",
  })
  async publish(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PublishOfferDto,
  ) {
    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : undefined;
    return this.offersService.publishVersion(
      workspaceId,
      id,
      dto.versionId,
      effectiveFrom,
    );
  }

  @Get(":id/scheduled")
  @MemberOnly()
  @ApiOperation({
    summary: "List scheduled versions",
    description: `Retrieves all scheduled (future-dated) versions for an offer.

**Use this to:**
- View upcoming pricing changes
- Check what versions are queued to become effective
- Audit scheduled changes before they go live

**Response includes:**
- All published versions with a future effectiveFrom date
- Ordered by effectiveFrom (soonest first)

**Note:** Only published versions with a future effectiveFrom appear here.
Immediately-effective versions are not included.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "List of scheduled versions",
    schema: {
      type: "array",
      items: OfferVersionSchema,
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
  @ApiResponse({ status: 404, description: "Offer not found" })
  async getScheduledVersions(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.offersService.getScheduledVersions(workspaceId, id);
  }

  @Post(":id/rollback")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rollback to previous version",
    description: `Creates a new draft version by copying configuration from a previously published version.

**Use this when:**
- A published change caused issues
- You want to revert to a known-good configuration
- You need to undo pricing changes

**Workflow:**
1. Call rollback with target version ID → Creates new draft with copied config
2. (Optional) Modify the draft if needed
3. Publish the draft → Previous config is now active again

**This is safe:** Does not modify any existing versions. Creates a new draft that you must explicitly publish.

**Example:** If you published v3 and it had issues, rollback to v2 creates v4 (draft) with v2's config. Publishing v4 makes it active.`,
  })
  @ApiParam({
    name: "id",
    description: "Offer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "New draft version created with copied configuration",
    schema: OfferVersionSchema,
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
  @ApiResponse({
    status: 404,
    description: "Offer or target version not found",
  })
  async rollback(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RollbackOfferDto,
  ) {
    return this.offersService.rollbackToVersion(
      workspaceId,
      id,
      dto.targetVersionId,
    );
  }
}
