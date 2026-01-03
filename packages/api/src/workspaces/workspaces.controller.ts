import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import { WorkspacesService } from "./workspaces.service";
import { StripeSyncService } from "./stripe-sync.service";
import { BillingService } from "../billing/billing.service";
import { WorkspaceId, OwnerOnly, MemberOnly } from "../common/decorators";
import { IsString, IsOptional, IsEnum, IsObject } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProviderStatusSchema } from "../common/schemas";

class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: "Workspace name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ["stripe", "zuora"] })
  @IsOptional()
  @IsEnum(["stripe", "zuora"])
  defaultProvider?: "stripe" | "zuora";

  @ApiPropertyOptional({ description: "Workspace settings" })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

@ApiTags("workspaces")
@ApiSecurity("api-key")
@Controller("workspaces")
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly stripeSyncService: StripeSyncService,
    private readonly billingService: BillingService,
  ) {}

  @Get("current")
  @MemberOnly()
  @ApiOperation({
    summary: "Get current workspace",
    description: `Retrieves details for the workspace associated with your API key.

**Response includes:**
- Workspace name and settings
- Default billing provider configuration
- Creation and update timestamps`,
  })
  @ApiResponse({
    status: 200,
    description: "Current workspace details",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        defaultProvider: { type: "string", enum: ["stripe", "zuora"] },
        settings: { type: "object" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
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
  async getCurrent(@WorkspaceId() workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Get("current/providers")
  @MemberOnly()
  @ApiOperation({
    summary: "Get billing provider status",
    description: `Returns the connection status of all billing providers for this workspace.

**Use this for:**
- Onboarding: Check which providers are configured
- Health monitoring: Verify provider connections are working
- Troubleshooting: See specific configuration errors

**Provider statuses:**
- \`connected\`: Provider is configured and API connection verified
- \`not_configured\`: Required environment variables missing
- \`error\`: Configuration exists but API connection failed
- \`disconnected\`: Provider was configured but is now unavailable

**Supported providers:**
- **Stripe**: Production ready
- **Zuora**: Supported (requires configuration)`,
  })
  @ApiResponse({
    status: 200,
    description: "Provider connection status",
    schema: ProviderStatusSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async getProviderStatus(@WorkspaceId() workspaceId: string) {
    const workspace = await this.workspacesService.findById(workspaceId);
    const settings = workspace?.settings as Record<string, unknown> | undefined;

    const providerStatus =
      await this.billingService.getProviderStatusForWorkspace(workspaceId, {
        stripeSecretKey: settings?.stripeSecretKey as string | undefined,
        stripeWebhookSecret: settings?.stripeWebhookSecret as
          | string
          | undefined,
      });

    return {
      defaultProvider: workspace?.defaultProvider ?? "stripe",
      ...providerStatus,
    };
  }

  @Patch("current")
  @OwnerOnly()
  @ApiOperation({ summary: "Update current workspace" })
  @ApiResponse({ status: 200, description: "Workspace updated" })
  async updateCurrent(
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(workspaceId, dto);
  }

  @Delete("current")
  @OwnerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete current workspace" })
  @ApiResponse({ status: 204, description: "Workspace deleted" })
  async deleteCurrent(@WorkspaceId() workspaceId: string) {
    await this.workspacesService.delete(workspaceId);
  }

  @Post("current/sync-stripe")
  @OwnerOnly()
  @ApiOperation({
    summary: "Sync from Stripe",
    description: `Import existing customers and subscriptions from Stripe.

Use this to recover from:
- Checkouts created before webhook was configured
- Missing subscriptions due to webhook failures

**What gets synced:**
- Customers: Created in Zentla and linked to Stripe customer ID
- Subscriptions: Matched to Zentla offers via Stripe price IDs

**Prerequisites:**
- Offers must be synced to Stripe first (prices must exist)
- Webhook should be configured to prevent future sync issues`,
  })
  @ApiResponse({
    status: 200,
    description: "Sync completed",
    schema: {
      type: "object",
      properties: {
        customersImported: { type: "number" },
        customersSkipped: { type: "number" },
        subscriptionsImported: { type: "number" },
        subscriptionsSkipped: { type: "number" },
        errors: { type: "array", items: { type: "string" } },
      },
    },
  })
  async syncFromStripe(@WorkspaceId() workspaceId: string) {
    return this.stripeSyncService.syncFromStripe(workspaceId);
  }
}
