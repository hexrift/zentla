import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WorkspaceId, AdminOnly, MemberOnly } from '../common/decorators';
import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CreateWebhookEndpointDto {
  @ApiProperty({
    description: `The URL where webhook events will be sent via HTTP POST.

**Requirements:**
- Must be a valid HTTPS URL (HTTP only allowed for localhost in test mode)
- Must be publicly accessible from Relay's servers
- Should respond with 2xx status within 30 seconds

**Your endpoint should:**
1. Verify the webhook signature using the secret
2. Process the event idempotently (we may retry)
3. Return 200 quickly (do heavy processing async)`,
    example: 'https://api.example.com/webhooks/relay',
  })
  @IsUrl()
  url!: string;

  @ApiProperty({
    description: `List of event types to subscribe to. Only events matching these types will be sent to this endpoint.

**Available events:**
- \`checkout.completed\` - Checkout session successfully completed
- \`subscription.created\` - New subscription created
- \`subscription.updated\` - Subscription modified (plan change, status update)
- \`subscription.canceled\` - Subscription canceled
- \`customer.created\` - New customer created
- \`customer.updated\` - Customer details modified
- \`invoice.paid\` - Invoice payment succeeded
- \`invoice.payment_failed\` - Invoice payment failed
- \`promotion.applied\` - Promotion code used

**Tip:** Subscribe only to events you need to minimize traffic.`,
    type: [String],
    example: ['subscription.created', 'subscription.updated', 'subscription.canceled'],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({
    description: 'Human-readable description to identify this endpoint in your dashboard.',
    example: 'Production - User provisioning service',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Custom metadata for this endpoint. Useful for tagging or categorization.',
    example: { environment: 'production', team: 'platform' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateWebhookEndpointDto {
  @ApiPropertyOptional({
    description: 'Updated webhook URL. Must meet same requirements as during creation.',
    example: 'https://api.example.com/webhooks/relay/v2',
  })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Updated list of events to subscribe to. This replaces the entire list.',
    type: [String],
    example: ['subscription.created', 'subscription.canceled'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({
    description: `Endpoint status:
- **active**: Receives webhook events normally
- **disabled**: Events are not sent (useful for temporary maintenance)`,
    enum: ['active', 'disabled'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'disabled'])
  status?: 'active' | 'disabled';

  @ApiPropertyOptional({
    description: 'Updated description.',
    example: 'Production - User provisioning service (updated)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated metadata. Replaces the entire metadata object.',
    example: { environment: 'production', team: 'platform', version: 2 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class QueryEndpointsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of endpoints to return per page.',
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
    description: 'Pagination cursor from a previous response.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags('webhooks')
@ApiSecurity('api-key')
@Controller('webhook-endpoints')
export class WebhookEndpointsController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: 'List webhook endpoints',
    description: `Retrieves all webhook endpoints configured for your workspace.

**Use this to:**
- Display endpoints in your settings dashboard
- Audit webhook configuration
- Find endpoints for debugging delivery issues

**Pagination:** Results are paginated. Use \`nextCursor\` for subsequent pages.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of webhook endpoints',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              url: { type: 'string', format: 'uri' },
              events: { type: 'array', items: { type: 'string' } },
              status: { type: 'string', enum: ['active', 'disabled'] },
              description: { type: 'string', nullable: true },
              metadata: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        hasMore: { type: 'boolean' },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryEndpointsDto
  ) {
    return this.webhooksService.findEndpoints(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  @MemberOnly()
  @ApiOperation({
    summary: 'Get webhook endpoint',
    description: `Retrieves details for a single webhook endpoint.

**Response includes:**
- Endpoint configuration (URL, events, status)
- Metadata
- Recent delivery statistics (if available)

**Note:** The webhook secret is not returned here. Use \`POST /webhook-endpoints/{id}/rotate-secret\` if you need a new secret.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook endpoint ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook endpoint details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        url: { type: 'string', format: 'uri' },
        events: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['active', 'disabled'] },
        description: { type: 'string', nullable: true },
        metadata: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Endpoint not found' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const endpoint = await this.webhooksService.findEndpointById(workspaceId, id);
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }
    return endpoint;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create webhook endpoint',
    description: `Creates a new webhook endpoint to receive event notifications.

**Setup workflow:**
1. Create endpoint with URL and events -> Returns endpoint with secret
2. Store the secret securely in your application
3. Implement signature verification in your webhook handler
4. Test with a manual event trigger or wait for real events

**Response includes:**
- Endpoint configuration
- **secret**: Signing secret for verifying webhooks (shown only once!)

**Signature verification:**
Each webhook includes a \`Relay-Signature\` header. Verify it using HMAC-SHA256:
\`\`\`
signature = HMAC-SHA256(secret, timestamp + '.' + payload)
\`\`\`

**Retry policy:** Failed deliveries (non-2xx response or timeout) are retried with exponential backoff for up to 24 hours.`,
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook endpoint created with signing secret',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        url: { type: 'string', format: 'uri' },
        events: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['active'] },
        secret: {
          type: 'string',
          description: 'Signing secret for verifying webhooks. Store securely - shown only once!',
          example: 'whsec_abc123...',
        },
        description: { type: 'string', nullable: true },
        metadata: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL or events list',
  })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateWebhookEndpointDto
  ) {
    return this.webhooksService.createEndpoint(workspaceId, dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({
    summary: 'Update webhook endpoint',
    description: `Updates an existing webhook endpoint configuration.

**Updatable fields:**
- \`url\`: Change the webhook destination
- \`events\`: Change which events are sent (replaces entire list)
- \`status\`: Enable/disable the endpoint
- \`description\`: Update the description
- \`metadata\`: Update custom metadata

**Changing URL:** If you change the URL, ensure the new endpoint can verify signatures with the existing secret.

**Disabling vs Deleting:** Use \`status: disabled\` for temporary maintenance. Events will queue and can be replayed later. Delete if you permanently don't need the endpoint.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook endpoint ID to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook endpoint updated',
  })
  @ApiResponse({ status: 404, description: 'Endpoint not found' })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookEndpointDto
  ) {
    return this.webhooksService.updateEndpoint(workspaceId, id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete webhook endpoint',
    description: `Permanently deletes a webhook endpoint.

**Warning:** This is immediate and irreversible.

**What happens:**
- Endpoint is removed immediately
- Pending webhook deliveries for this endpoint are cancelled
- Historical delivery logs may be retained for auditing

**Before deleting:** Consider disabling the endpoint first if you might need it again. You can always re-enable it, but deleted endpoints and their secrets cannot be recovered.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook endpoint ID to delete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Webhook endpoint deleted (no content)',
  })
  @ApiResponse({ status: 404, description: 'Endpoint not found' })
  async delete(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.webhooksService.deleteEndpoint(workspaceId, id);
  }

  @Post(':id/rotate-secret')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate webhook secret',
    description: `Generates a new signing secret for a webhook endpoint.

**Use this when:**
- You suspect the secret has been compromised
- Following security rotation policies
- Onboarding new team members without sharing old secrets

**Rotation process:**
1. Call this endpoint -> Returns new secret
2. Update your webhook handler with the new secret
3. Both old and new secrets work for a brief grace period
4. Old secret is invalidated after the grace period

**Response includes:**
- \`secret\`: New signing secret (shown only once!)

**Important:** Store the new secret securely before leaving this response. It will not be shown again.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook endpoint ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'New secret generated',
    schema: {
      type: 'object',
      properties: {
        secret: {
          type: 'string',
          description: 'New signing secret. Store securely - shown only once!',
          example: 'whsec_new123...',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Endpoint not found' })
  async rotateSecret(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const newSecret = await this.webhooksService.rotateSecret(workspaceId, id);
    return { secret: newSecret };
  }
}
