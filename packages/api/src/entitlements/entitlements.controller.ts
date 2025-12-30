import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from "@nestjs/swagger";
import { EntitlementsService } from "./entitlements.service";
import { WorkspaceId, MemberOnly } from "../common/decorators";
import { EntitlementSchema, EntitlementCheckSchema } from "../common/schemas";
import { IsString, IsArray, ArrayMinSize } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CheckEntitlementsDto {
  @ApiProperty({
    description: `Feature keys to check. These should match the \`featureKey\` values defined in your offer configurations.

**Example keys:**
- \`"api_calls"\` - API usage quota
- \`"seats"\` - Team member limit
- \`"premium_features"\` - Boolean feature flag
- \`"storage_gb"\` - Storage quota

Check multiple keys in a single request to minimize API calls.`,
    type: [String],
    example: ["api_calls", "premium_features", "seats"],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  featureKeys!: string[];
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("entitlements")
@ApiSecurity("api-key")
@Controller("customers/:customerId/entitlements")
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: "Get all customer entitlements",
    description: `Retrieves all entitlements currently granted to a customer from their active subscriptions.

**Use this to:**
- Display feature access in your UI (show/hide premium features)
- Initialize your app with customer capabilities on login
- Debug entitlement issues in admin dashboards

**How entitlements work:**
- Each subscription grants entitlements defined in its offer version
- If a customer has multiple subscriptions, entitlements are merged
- When subscriptions end, their entitlements are revoked

**Response includes:**
- All active entitlements with their values
- Source subscription for each entitlement
- Value types for proper interpretation

**Caching recommendation:** Cache entitlements client-side for performance. Invalidate when receiving \`subscription.created\`, \`subscription.updated\`, or \`subscription.canceled\` webhooks.`,
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID to get entitlements for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "All entitlements for the customer",
    schema: {
      type: "object",
      properties: {
        customerId: { type: "string", format: "uuid" },
        entitlements: {
          type: "array",
          items: EntitlementSchema,
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
  @ApiResponse({
    status: 404,
    description: "Customer not found",
  })
  async getCustomerEntitlements(
    @WorkspaceId() workspaceId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string
  ) {
    return this.entitlementsService.getCustomerEntitlements(
      workspaceId,
      customerId
    );
  }

  @Get("check/:featureKey")
  @MemberOnly()
  @ApiOperation({
    summary: "Check single entitlement",
    description: `Checks if a customer has access to a specific feature and returns its value.

**Use this for:**
- Feature gate checks before allowing an action
- Quick access verification for a single feature
- Real-time permission checks

**Response interpretation by valueType:**
- \`boolean\`: Check \`hasAccess\` - true means feature is enabled
- \`number\`: Check \`value\` for the quota/limit
- \`string\`: Check \`value\` for tier name or custom value
- \`unlimited\`: \`hasAccess\` is true, no limit applies

**Example usage in your app:**
\`\`\`typescript
const result = await api.entitlements.check(customerId, 'premium_features');
if (result.hasAccess) {
  // Show premium feature
}
\`\`\`

**Performance:** This endpoint is optimized for low-latency. Consider caching results client-side with webhook-based invalidation for high-frequency checks.`,
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "featureKey",
    description: "Feature key to check (as defined in offer entitlements)",
    example: "premium_features",
  })
  @ApiResponse({
    status: 200,
    description: "Entitlement check result",
    schema: EntitlementCheckSchema,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async checkSingleEntitlement(
    @WorkspaceId() workspaceId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("featureKey") featureKey: string
  ) {
    return this.entitlementsService.checkEntitlement(
      workspaceId,
      customerId,
      featureKey
    );
  }

  @Post("check")
  @MemberOnly()
  @ApiOperation({
    summary: "Check multiple entitlements",
    description: `Checks multiple entitlements in a single request, more efficient than individual calls.

**Use this for:**
- Initializing app state with multiple feature checks
- Permission checks across several features at once
- Reducing API calls when checking multiple features

**Batch advantages:**
- Single network round-trip for multiple checks
- Consistent point-in-time snapshot of all entitlements
- Lower latency than multiple individual requests

**Request example:**
\`\`\`json
{
  "featureKeys": ["api_calls", "premium_features", "seats", "storage_gb"]
}
\`\`\`

**Response:** Returns an object mapping each requested key to its entitlement result, making it easy to destructure in your code.

**Implementation tip:**
\`\`\`typescript
const { api_calls, premium_features, seats } = await api.entitlements.checkMany(
  customerId,
  ['api_calls', 'premium_features', 'seats']
);
\`\`\``,
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Entitlement check results for all requested features",
    schema: {
      type: "object",
      properties: {
        customerId: { type: "string", format: "uuid" },
        results: {
          type: "object",
          additionalProperties: EntitlementCheckSchema,
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
  async checkMultipleEntitlements(
    @WorkspaceId() workspaceId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: CheckEntitlementsDto
  ) {
    return this.entitlementsService.checkMultipleEntitlements(
      workspaceId,
      customerId,
      dto.featureKeys
    );
  }
}
