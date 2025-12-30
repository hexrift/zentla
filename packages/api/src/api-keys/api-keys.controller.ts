import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyService } from '../auth/services/api-key.service';
import { WorkspaceId, OwnerOnly } from '../common/decorators';
import { ApiKeySchema } from '../common/schemas';
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CreateApiKeyDto {
  @ApiProperty({
    description: `Human-readable name to identify this API key. Choose a name that indicates its purpose or the service using it.

**Naming conventions:**
- Include environment: "Production Backend", "Staging CI/CD"
- Include purpose: "Webhook Service", "Admin Dashboard"
- Include owner: "John's Local Dev", "GitHub Actions"`,
    example: 'Production Backend Service',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: `Permission level for this API key. Choose the minimum required permissions.

**Roles:**
- **owner**: Full access including API key management and workspace settings
- **admin**: Full access to all resources except API key management
- **member**: Read-write access to operational resources (offers, customers, subscriptions)
- **readonly**: Read-only access to all resources

**Best practices:**
- Use \`readonly\` for dashboards and analytics
- Use \`member\` for backend services managing subscriptions
- Use \`admin\` sparingly for admin tools
- Reserve \`owner\` for critical operations`,
    enum: ['owner', 'admin', 'member', 'readonly'],
    example: 'member',
  })
  @IsEnum(['owner', 'admin', 'member', 'readonly'])
  role!: 'owner' | 'admin' | 'member' | 'readonly';

  @ApiProperty({
    description: `Environment this key operates in. Keys are isolated by environment.

**Environments:**
- **test**: Use for development and testing. Only affects test data and Stripe test mode.
- **live**: Use for production. Affects real customer data and billing.

**Important:** Test keys cannot access live data and vice versa. Create separate keys for each environment.`,
    enum: ['live', 'test'],
    example: 'test',
  })
  @IsEnum(['live', 'test'])
  environment!: 'live' | 'test';

  @ApiPropertyOptional({
    description: `Optional expiration date (ISO 8601 format). After this date, the key becomes invalid.

**Use cases:**
- Temporary access for contractors
- Time-limited integrations
- Security policy compliance

**Omit** for keys that should not expire (you can always revoke manually).`,
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags('api-keys')
@ApiSecurity('api-key')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @OwnerOnly()
  @ApiOperation({
    summary: 'List API keys',
    description: `Retrieves all API keys for your workspace.

**Use this to:**
- Audit existing API keys and their permissions
- Monitor key usage (last used timestamps)
- Identify keys approaching expiration

**Security:** This endpoint requires \`owner\` role. The actual key secrets are never returned - only metadata and the key prefix for identification.

**Response includes:**
- Key metadata (name, role, environment)
- Key prefix (first few characters for identification)
- Usage information (last used timestamp)
- Expiration status`,
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys (secrets are not included)',
    schema: {
      type: 'array',
      items: ApiKeySchema,
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires owner role' })
  async findAll(@WorkspaceId() workspaceId: string) {
    const keys = await this.apiKeyService.listApiKeys(workspaceId);
    // Don't expose the hash, just return safe fields
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      role: key.role,
      environment: key.environment,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));
  }

  @Post()
  @OwnerOnly()
  @ApiOperation({
    summary: 'Create API key',
    description: `Creates a new API key for authenticating with the Relay API.

**Important:** The secret is only returned once in this response. Store it securely immediately.

**Key format:**
- Test keys: \`rl_test_...\`
- Live keys: \`rl_live_...\`

**Security best practices:**
- Store keys in environment variables or a secrets manager
- Never commit keys to version control
- Use the minimum role required for each use case
- Set expiration dates for temporary access
- Rotate keys periodically

**After creation:**
Use the key in the \`Authorization\` header:
\`\`\`
Authorization: Bearer rl_test_your_key_here
\`\`\`

Or as the \`X-API-Key\` header:
\`\`\`
X-API-Key: rl_test_your_key_here
\`\`\``,
  })
  @ApiResponse({
    status: 201,
    description: 'API key created. The secret is shown only once!',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Key ID for future management operations (revocation)',
        },
        secret: {
          type: 'string',
          description: 'The complete API key secret. Store securely - this is the only time it will be shown!',
          example: 'rl_test_abc123def456...',
        },
        prefix: {
          type: 'string',
          description: 'Key prefix for identification in logs and the key list',
          example: 'rl_test_abc...',
        },
        message: {
          type: 'string',
          description: 'Important reminder about storing the secret',
          example: 'Store this secret securely. It will not be shown again.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (e.g., invalid role or environment)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires owner role to create API keys',
  })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateApiKeyDto
  ) {
    const result = await this.apiKeyService.generateApiKey(
      workspaceId,
      dto.name,
      dto.role,
      dto.environment,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined
    );

    return {
      id: result.id,
      secret: result.secret, // Only shown once!
      prefix: result.prefix,
      message: 'Store this secret securely. It will not be shown again.',
    };
  }

  @Delete(':id')
  @OwnerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke API key',
    description: `Permanently revokes an API key, immediately preventing any further use.

**Use this when:**
- A key has been compromised
- An employee/contractor no longer needs access
- Rotating keys as part of security policy
- Cleaning up unused keys

**Immediate effect:** Once revoked, any requests using this key will fail immediately with 401 Unauthorized.

**Cannot be undone:** Revocation is permanent. If you need the same access, create a new key.

**Best practice:** Before revoking a production key, ensure any services using it have been updated with a new key to avoid outages.`,
  })
  @ApiParam({
    name: 'id',
    description: 'API key ID to revoke (from the key list, not the secret itself)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'API key revoked (no content)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing API key' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires owner role to revoke API keys',
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found',
  })
  async revoke(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.apiKeyService.revokeApiKey(workspaceId, id);
  }
}
