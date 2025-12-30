import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { WorkspaceId, MemberOnly } from '../common/decorators';
import {
  IsOptional,
  Matches,
  IsUrl,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsEmail,
  IsObject,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// UUID regex that accepts any UUID-formatted string (including non-RFC4122 compliant)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CreateCheckoutSessionDto {
  @ApiProperty({
    description: `The offer ID to create a checkout session for. The offer must have a published version.

**How offers work:**
- Each offer has one or more versions
- By default, the currently published version is used
- Use \`offerVersionId\` to override with a specific version`,
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @Matches(UUID_REGEX, { message: 'offerId must be a valid UUID' })
  offerId!: string;

  @ApiPropertyOptional({
    description: `Specific offer version ID to use instead of the currently published version. Use this for:
- Testing draft versions in a sandbox
- Creating subscriptions on legacy pricing
- A/B testing different configurations

**Note:** The version must belong to the specified offer.`,
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'offerVersionId must be a valid UUID' })
  offerVersionId?: string;

  @ApiPropertyOptional({
    description: `Existing Relay customer ID to associate with this checkout. When provided:
- Customer's saved payment methods may be available
- Customer email is pre-filled from their profile
- Subscription is linked to their existing account

**Omit this** for new customers or guest checkout - a customer record will be created automatically when the checkout completes.`,
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'customerId must be a valid UUID' })
  customerId?: string;

  @ApiPropertyOptional({
    description: `Email address to pre-fill in the checkout form for new customers. Use this when:
- You've already collected the email in your app
- Creating checkout links for email campaigns
- You want to streamline the checkout experience

**Ignored** if \`customerId\` is provided (customer's existing email is used instead).`,
    example: 'customer@example.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({
    description: `URL to redirect the customer to after successful payment. The checkout session ID is appended as a query parameter: \`?session_id={id}\`.

**Example flow:**
1. Customer completes payment
2. Redirected to: \`https://app.example.com/success?session_id=abc123\`
3. Your app calls \`GET /checkout/sessions/{id}\` to verify and get subscription details

**Requirements:**
- Must be a valid HTTPS URL (HTTP allowed for localhost)
- Should be a page in your application that handles post-checkout logic`,
    example: 'https://app.example.com/checkout/success',
  })
  @IsUrl()
  successUrl!: string;

  @ApiProperty({
    description: `URL to redirect the customer to if they cancel or abandon the checkout.

**Use cases:**
- Return to pricing page
- Return to cart/offer selection
- Show a "comeback" offer

The checkout session remains valid (until expiration) so they can return to complete it.`,
    example: 'https://app.example.com/pricing',
  })
  @IsUrl()
  cancelUrl!: string;

  @ApiPropertyOptional({
    description: `When \`true\`, displays a promo code input field in the checkout UI, allowing customers to enter codes manually.

**Default:** \`false\`

**When to enable:**
- You want customers to enter codes at checkout
- Running public promotions

**When to disable:**
- Using \`promotionCode\` to pre-apply a specific discount
- Promotions are invitation-only (use direct links with \`promotionCode\`)`,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowPromotionCodes?: boolean;

  @ApiPropertyOptional({
    description: `Pre-apply a specific promotion code to the checkout. The discount is shown immediately and cannot be removed by the customer.

**Examples:**
- \`"SUMMER25"\` - 25% off summer sale
- \`"WELCOME10"\` - New customer discount

**Validation:**
- Code must exist and be published
- Code must be applicable to the selected offer
- Redemption limits must not be exceeded

**Fails if:** Code is invalid, expired, or not applicable. Returns 400 with details.`,
    example: 'SUMMER25',
  })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({
    description: `Override the trial period configured in the offer. Specified in days.

**Use cases:**
- Extended trials for enterprise prospects
- Shortened trials for time-sensitive campaigns
- Trial extensions for existing users trying a new plan

**Behavior:**
- Overrides the offer's default trial settings
- Set to \`0\` to explicitly disable trials even if the offer has one
- Customer is charged after trial ends

**Range:** 1-365 days`,
    example: 14,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trialDays?: number;

  @ApiPropertyOptional({
    description: `Arbitrary key-value data stored with the checkout session. Useful for:
- Tracking attribution (utm parameters, referral codes)
- Passing internal identifiers
- Custom business logic

**This metadata:**
- Is stored on the checkout record
- Is copied to the subscription when checkout completes
- Is included in webhook events

**Example:**
\`\`\`json
{
  "utm_source": "google",
  "internal_campaign": "q4_growth",
  "sales_rep_id": "rep-123"
}
\`\`\``,
    example: { campaign: 'summer_2024', referrer: 'partner_site' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags('checkout')
@ApiSecurity('api-key')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('sessions')
  @MemberOnly()
  @ApiOperation({
    summary: 'Create checkout session',
    description: `Creates a hosted checkout session for a customer to subscribe to an offer.

**Workflow:**
1. Call this endpoint with offer and redirect URLs
2. Redirect customer to the returned \`url\`
3. Customer completes payment on hosted checkout page
4. Customer is redirected to \`successUrl\` with session ID
5. Your server verifies the session and provisions access

**What this creates:**
- A checkout record in Relay with \`pending\` status
- A Stripe Checkout Session linked to this record
- Appropriate Stripe Product/Price if not already synced

**Session lifecycle:**
- \`pending\`: Created, awaiting customer action
- \`completed\`: Payment successful, subscription created
- \`expired\`: Customer didn't complete within 24 hours

**Promotion handling:**
- Use \`promotionCode\` to pre-apply a specific discount
- Use \`allowPromotionCodes: true\` to let customers enter codes
- Both can be combined

**Example request:**
\`\`\`json
{
  "offerId": "offer-uuid",
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/pricing",
  "customerEmail": "user@example.com",
  "promotionCode": "LAUNCH25",
  "metadata": { "source": "pricing_page" }
}
\`\`\``,
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created. Redirect customer to the URL.',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Relay checkout session ID. Use this to query status.',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        url: {
          type: 'string',
          format: 'uri',
          description: 'Hosted checkout page URL. Redirect the customer here.',
          example: 'https://checkout.stripe.com/c/pay/cs_test_...',
        },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'When the session expires (typically 24 hours). After this, the URL is invalid.',
          example: '2024-01-16T12:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: `Invalid request. Common causes:
- Offer not found or has no published version
- Invalid promotion code (not found, expired, not applicable)
- Customer ID not found in workspace`,
  })
  async createSession(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCheckoutSessionDto
  ) {
    const session = await this.checkoutService.create(workspaceId, dto);

    return {
      id: session.id,
      url: session.url,
      expiresAt: session.expiresAt,
    };
  }

  @Get('sessions/:id')
  @MemberOnly()
  @ApiOperation({
    summary: 'Get checkout session',
    description: `Retrieves the current status and details of a checkout session.

**Use this to:**
- Verify a checkout completed successfully after redirect
- Check if a session is still pending or has expired
- Get the created subscription ID after completion

**Typical flow:**
1. Customer completes checkout and is redirected to your \`successUrl\`
2. Your server extracts session ID from URL: \`?session_id={id}\`
3. Call this endpoint to verify status is \`completed\`
4. Get the \`subscriptionId\` and provision access

**Session statuses:**
- \`pending\`: Customer hasn't completed checkout yet
- \`completed\`: Payment succeeded, subscription active
- \`expired\`: Session timed out (24 hours), no action taken

**Security note:** Always verify checkout completion server-side. Don't trust client-side redirects alone - users could manually navigate to your success URL.`,
  })
  @ApiParam({
    name: 'id',
    description: 'Checkout session ID (returned when creating the session)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Checkout session details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Session ID' },
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'expired'],
          description: 'Current session status',
        },
        offerId: { type: 'string', format: 'uuid', description: 'Offer used for this checkout' },
        offerVersionId: { type: 'string', format: 'uuid', description: 'Specific version used' },
        customerId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'Customer ID (set after completion for new customers)',
        },
        subscriptionId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'Created subscription ID (only set when status is completed)',
        },
        promotionCode: {
          type: 'string',
          nullable: true,
          description: 'Promotion code applied to this checkout (if any)',
        },
        metadata: {
          type: 'object',
          description: 'Custom metadata passed when creating the session',
        },
        createdAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time' },
        completedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'When checkout was completed (null if pending/expired)',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Checkout session not found in this workspace',
  })
  async getSession(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const checkout = await this.checkoutService.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout session ${id} not found`);
    }
    return checkout;
  }
}
