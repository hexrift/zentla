import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { WorkspaceId, AdminOnly, MemberOnly } from '../common/decorators';
import { ETagInterceptor, parseETagVersion } from '../common/interceptors/etag.interceptor';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CreateCustomerDto {
  @ApiProperty({
    description: `Customer's email address. Used for:
- Billing communications from Stripe
- Account identification
- Pre-filling checkout forms

**Uniqueness:** Email is unique per workspace. Creating a customer with an existing email will fail.`,
    example: 'customer@example.com',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Customer display name. Shown in admin dashboards and may be used in billing communications.',
    example: 'Acme Corporation',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: `Your application's unique identifier for this customer. Use this to link Relay customers to users in your system.

**Use cases:**
- Store your database user ID
- Link to CRM contact ID
- Maintain sync with your authentication system

**Uniqueness:** External ID is unique per workspace if provided.`,
    example: 'user_12345',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({
    description: `Arbitrary key-value data stored with the customer. Useful for:
- Custom attributes (company size, industry, plan tier)
- Integration data
- Feature flags specific to this customer

**Example:**
\`\`\`json
{
  "company_size": "50-100",
  "industry": "saas",
  "referral_source": "product_hunt"
}
\`\`\``,
    example: { company_size: '50-100', source: 'website' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateCustomerDto {
  @ApiPropertyOptional({
    description: 'Updated email address. Must be unique within the workspace.',
    example: 'newemail@example.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Updated customer name.',
    example: 'Acme Corp (Enterprise)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated external ID. Must be unique within the workspace if provided.',
    example: 'user_67890',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({
    description: 'Updated metadata. This replaces the entire metadata object (not a partial merge). To keep existing values, include them in the update.',
    example: { company_size: '100-500', upgraded: true },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class QueryCustomersDto {
  @ApiPropertyOptional({
    description: 'Maximum number of customers to return per page.',
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
    description: 'Pagination cursor from a previous response. Pass `nextCursor` from the last response to fetch the next page.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact email match. Useful for finding a specific customer by their email address.',
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact external ID match. Useful for finding a customer by your system ID.',
    example: 'user_12345',
  })
  @IsOptional()
  @IsString()
  externalId?: string;
}

class CreatePortalSessionDto {
  @ApiProperty({
    description: `URL to redirect the customer to after they exit the billing portal.

**The portal allows customers to:**
- View and update payment methods
- View invoice history
- Manage subscription (if configured in Stripe)

**Requirements:**
- Must be a valid HTTPS URL (HTTP allowed for localhost)
- Should be a page in your application`,
    example: 'https://app.example.com/settings/billing',
  })
  @IsString()
  returnUrl!: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags('customers')
@ApiSecurity('api-key')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: 'List customers',
    description: `Retrieves a paginated list of customers in your workspace.

**Use this to:**
- Display customers in your admin dashboard
- Search for customers by email or external ID
- Build customer management interfaces

**Pagination:** Results are returned in pages of up to 100 items. Use the \`nextCursor\` from the response to fetch subsequent pages.

**Filtering:** Use \`email\` for exact email match or \`externalId\` to find customers by your system's identifier.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of customers',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid', description: 'Relay customer ID' },
              email: { type: 'string', format: 'email' },
              name: { type: 'string', nullable: true },
              externalId: { type: 'string', nullable: true, description: 'Your system ID' },
              metadata: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        hasMore: { type: 'boolean', description: 'True if more pages exist' },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryCustomersDto
  ) {
    return this.customersService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      email: query.email,
      externalId: query.externalId,
    });
  }

  @Get(':id')
  @MemberOnly()
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get customer details',
    description: `Retrieves complete details for a single customer.

**Use this to:**
- Display customer profile in your admin UI
- Get customer metadata
- Check external ID mapping

**Response includes:**
- Customer profile (email, name, external ID)
- Custom metadata
- Version number for concurrency control
- Timestamps

**Concurrency Control:**
The response includes an \`ETag\` header with the format \`W/"id-version"\`.
Use this value in the \`If-Match\` header when updating to prevent concurrent modification conflicts.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Customer ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer details',
    headers: {
      ETag: {
        description: 'Resource version for concurrency control. Use in If-Match header for updates.',
        schema: { type: 'string', example: 'W/"123e4567-e89b-12d3-a456-426614174000-1"' },
      },
    },
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string', nullable: true },
        externalId: { type: 'string', nullable: true },
        metadata: { type: 'object' },
        version: { type: 'integer', description: 'Resource version for concurrency control' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found in this workspace',
  })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const customer = await this.customersService.findById(workspaceId, id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create customer',
    description: `Creates a new customer in your workspace.

**When to create customers explicitly:**
- Pre-provisioning accounts before they subscribe
- Importing existing customers from another system
- Creating customer records for manual billing

**Note:** Customers are also created automatically when:
- A checkout session completes for a new email
- Webhooks sync a new Stripe customer

**Side effects:**
- Creates customer record in Relay database
- Creates corresponding Stripe customer
- Stores provider reference for future syncing`,
  })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'New customer ID' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string', nullable: true },
        externalId: { type: 'string', nullable: true },
        metadata: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (e.g., duplicate email or external ID)',
  })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCustomerDto
  ) {
    return this.customersService.create(workspaceId, dto);
  }

  @Patch(':id')
  @AdminOnly()
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Update customer',
    description: `Updates an existing customer's information.

**Updatable fields:**
- \`email\`: Must remain unique within workspace
- \`name\`: Display name
- \`externalId\`: Your system identifier (must remain unique)
- \`metadata\`: Custom key-value data (replaces entire object)

**Concurrency Control (Optimistic Locking):**
To prevent concurrent modification conflicts, include the \`If-Match\` header with the ETag value from a previous GET request.

If the resource has been modified since you fetched it, the update will fail with a 412 Precondition Failed error.

**Workflow:**
1. GET the customer to obtain the ETag header
2. PATCH with \`If-Match: <etag>\` header
3. If 412 error, re-fetch and retry

**Side effects:**
- Updates Relay customer record
- Syncs changes to Stripe customer
- Increments version number

**Note on metadata:** The metadata update replaces the entire object. To preserve existing keys, include them in your update request.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Customer ID to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description: 'ETag from a previous GET request for concurrency control. Format: W/"id-version"',
    example: 'W/"123e4567-e89b-12d3-a456-426614174000-1"',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer updated successfully',
    headers: {
      ETag: {
        description: 'New resource version after update',
        schema: { type: 'string', example: 'W/"123e4567-e89b-12d3-a456-426614174000-2"' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - duplicate email/externalId or version mismatch',
  })
  @ApiResponse({
    status: 412,
    description: 'Precondition Failed - If-Match header does not match current version. Re-fetch and retry.',
  })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateCustomerDto
  ) {
    // Parse version from If-Match header if provided
    const requiredVersion = ifMatch ? parseETagVersion(ifMatch) ?? undefined : undefined;
    return this.customersService.update(workspaceId, id, dto, requiredVersion);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete customer',
    description: `Permanently deletes a customer and all associated data.

**Warning:** This is a destructive operation that cannot be undone.

**What gets deleted:**
- Customer record in Relay
- Associated entitlements

**What is NOT deleted:**
- Stripe customer (preserved for billing records)
- Historical subscription data (preserved for compliance)
- Invoices and payment history (in Stripe)

**Constraints:**
- Cannot delete customers with active subscriptions
- Cancel all subscriptions first before deleting`,
  })
  @ApiParam({
    name: 'id',
    description: 'Customer ID to delete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Customer deleted successfully (no content)',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete customer with active subscriptions',
  })
  async delete(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.customersService.delete(workspaceId, id);
  }

  @Post(':id/portal')
  @MemberOnly()
  @ApiOperation({
    summary: 'Create billing portal session',
    description: `Creates a Stripe Customer Portal session for self-service billing management.

**Portal capabilities (configurable in Stripe Dashboard):**
- View and download invoices
- Update payment methods
- Update billing information
- Cancel or modify subscriptions (if enabled)

**Workflow:**
1. Call this endpoint with customer ID and return URL
2. Redirect customer to the returned \`url\`
3. Customer manages their billing
4. Customer clicks "back" and is redirected to your \`returnUrl\`

**Session lifecycle:**
- Sessions expire after a short time if not used
- Each session is single-use

**Security:** Only authenticated customers should be able to access their own portal. Verify the customer ID belongs to the requesting user.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Customer ID to create portal session for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Portal session created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Portal session ID' },
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL to redirect customer to',
          example: 'https://billing.stripe.com/session/...',
        },
        returnUrl: { type: 'string', description: 'Where customer returns after' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or has no Stripe customer record',
  })
  async createPortalSession(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePortalSessionDto
  ) {
    const session = await this.customersService.createPortalSession(
      workspaceId,
      id,
      dto.returnUrl
    );
    return session;
  }
}
