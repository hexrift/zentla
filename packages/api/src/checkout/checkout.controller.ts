import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  NotFoundException,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { CheckoutService } from "./checkout.service";
import { WorkspaceId, MemberOnly } from "../common/decorators";
import { CheckoutSessionSchema, CheckoutIntentSchema, CheckoutQuoteSchema } from "../common/schemas";
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
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// UUID regex that accepts any UUID-formatted string (including non-RFC4122 compliant)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @Matches(UUID_REGEX, { message: "offerId must be a valid UUID" })
  offerId!: string;

  @ApiPropertyOptional({
    description: `Specific offer version ID to use instead of the currently published version. Use this for:
- Testing draft versions in a sandbox
- Creating subscriptions on legacy pricing
- A/B testing different configurations

**Note:** The version must belong to the specified offer.`,
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "offerVersionId must be a valid UUID" })
  offerVersionId?: string;

  @ApiPropertyOptional({
    description: `Existing Relay customer ID to associate with this checkout. When provided:
- Customer's saved payment methods may be available
- Customer email is pre-filled from their profile
- Subscription is linked to their existing account

**Omit this** for new customers or guest checkout - a customer record will be created automatically when the checkout completes.`,
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "customerId must be a valid UUID" })
  customerId?: string;

  @ApiPropertyOptional({
    description: `Email address to pre-fill in the checkout form for new customers. Use this when:
- You've already collected the email in your app
- Creating checkout links for email campaigns
- You want to streamline the checkout experience

**Ignored** if \`customerId\` is provided (customer's existing email is used instead).`,
    example: "customer@example.com",
    format: "email",
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
    example: "https://app.example.com/checkout/success",
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  successUrl!: string;

  @ApiProperty({
    description: `URL to redirect the customer to if they cancel or abandon the checkout.

**Use cases:**
- Return to pricing page
- Return to cart/offer selection
- Show a "comeback" offer

The checkout session remains valid (until expiration) so they can return to complete it.`,
    example: "https://app.example.com/pricing",
  })
  @IsUrl({ require_tld: false, require_protocol: true })
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
    example: "SUMMER25",
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
    example: { campaign: "summer_2024", referrer: "partner_site" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============================================================================
// HEADLESS CHECKOUT DTOs
// ============================================================================

class CreateQuoteDto {
  @ApiProperty({
    description: "The offer ID to get a quote for.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @Matches(UUID_REGEX, { message: "offerId must be a valid UUID" })
  offerId!: string;

  @ApiPropertyOptional({
    description: "Specific offer version ID. If omitted, uses the currently published version.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "offerVersionId must be a valid UUID" })
  offerVersionId?: string;

  @ApiPropertyOptional({
    description: "Promotion code to apply to the quote.",
    example: "SUMMER25",
  })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({
    description: "Customer ID for per-customer promotion validation.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "customerId must be a valid UUID" })
  customerId?: string;
}

class CreateCheckoutIntentDto {
  @ApiProperty({
    description: "The offer ID to create an intent for.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @Matches(UUID_REGEX, { message: "offerId must be a valid UUID" })
  offerId!: string;

  @ApiPropertyOptional({
    description: "Specific offer version ID. If omitted, uses the currently published version.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "offerVersionId must be a valid UUID" })
  offerVersionId?: string;

  @ApiPropertyOptional({
    description: `Existing customer ID. If omitted, provide \`customerEmail\` for new customer creation.`,
    example: "123e4567-e89b-12d3-a456-426614174000",
    format: "uuid",
  })
  @IsOptional()
  @Matches(UUID_REGEX, { message: "customerId must be a valid UUID" })
  customerId?: string;

  @ApiPropertyOptional({
    description: "Email for new customer creation. Required if customerId is not provided.",
    example: "customer@example.com",
    format: "email",
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({
    description: "Promotion code to lock in with this intent.",
    example: "SUMMER25",
  })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({
    description: "Override trial days from the offer configuration.",
    example: 14,
    minimum: 0,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @ApiPropertyOptional({
    description: "Arbitrary metadata to store with the intent and resulting subscription.",
    example: { campaign: "summer_2024" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("checkout")
@ApiSecurity("api-key")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  // ============================================================================
  // LIST & STATS ENDPOINTS
  // ============================================================================

  @Get("sessions")
  @MemberOnly()
  @ApiOperation({
    summary: "List checkout sessions",
    description: "List all checkout sessions with optional status filter.",
  })
  @ApiResponse({ status: 200, description: "List of checkout sessions" })
  async listSessions(
    @WorkspaceId() workspaceId: string,
    @Query("status") status?: string,
    @Query("limit") limitParam?: string,
    @Query("cursor") cursor?: string
  ) {
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    return this.checkoutService.listSessions(workspaceId, { status, limit, cursor });
  }

  @Get("intents")
  @MemberOnly()
  @ApiOperation({
    summary: "List checkout intents",
    description: "List all checkout intents (headless) with optional status filter.",
  })
  @ApiResponse({ status: 200, description: "List of checkout intents" })
  async listIntents(
    @WorkspaceId() workspaceId: string,
    @Query("status") status?: string,
    @Query("limit") limitParam?: string,
    @Query("cursor") cursor?: string
  ) {
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    return this.checkoutService.listIntents(workspaceId, { status, limit, cursor });
  }

  @Get("stats")
  @MemberOnly()
  @ApiOperation({
    summary: "Get checkout statistics",
    description: "Get aggregated statistics for checkout sessions and intents.",
  })
  @ApiResponse({ status: 200, description: "Checkout statistics" })
  async getStats(@WorkspaceId() workspaceId: string) {
    return this.checkoutService.getCheckoutStats(workspaceId);
  }

  // ============================================================================
  // SESSION ENDPOINTS
  // ============================================================================

  @Post("sessions")
  @MemberOnly()
  @ApiOperation({
    summary: "Create checkout session",
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
    description: "Checkout session created. Redirect customer to the URL.",
    schema: CheckoutSessionSchema,
  })
  @ApiResponse({
    status: 400,
    description: `Invalid request. Common causes:
- Offer not found or has no published version
- Invalid promotion code (not found, expired, not applicable)
- Customer ID not found in workspace`,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
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

  @Get("sessions/:id")
  @MemberOnly()
  @ApiOperation({
    summary: "Get checkout session",
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
    name: "id",
    description: "Checkout session ID (returned when creating the session)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Checkout session details",
    schema: CheckoutSessionSchema,
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
    description: "Checkout session not found in this workspace",
  })
  async getSession(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    const checkout = await this.checkoutService.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout session ${id} not found`);
    }
    return checkout;
  }

  // ==========================================================================
  // HEADLESS CHECKOUT ENDPOINTS
  // ==========================================================================

  @Post("quotes")
  @MemberOnly()
  @ApiOperation({
    summary: "Get checkout quote",
    description: `Returns a pricing breakdown for an offer, optionally with a promotion code applied.

**Use this to:**
- Show accurate pricing before checkout
- Validate promotion codes and display discounts
- Pre-render checkout UI with totals

**Response includes:**
- Subtotal, discount, tax, and total amounts
- Currency and billing interval
- Trial information if applicable
- Promotion details if code applied

**Note:** Quotes are not persisted. Create a checkout intent to lock in pricing.`,
  })
  @ApiResponse({
    status: 200,
    description: "Quote with pricing breakdown",
    schema: CheckoutQuoteSchema,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid offer or promotion code",
  })
  async createQuote(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateQuoteDto
  ) {
    return this.checkoutService.createQuote(workspaceId, dto);
  }

  @Post("intents")
  @MemberOnly()
  @ApiHeader({
    name: "Idempotency-Key",
    description: "Unique key to prevent duplicate intent creation. Reusing the same key returns the existing intent.",
    required: false,
    example: "intent_abc123",
  })
  @ApiOperation({
    summary: "Create checkout intent",
    description: `Creates a checkout intent for headless/custom checkout UIs.

**Flow:**
1. Create intent → returns \`clientSecret\` for Stripe.js
2. Client calls \`stripe.confirmPayment()\` with the client secret
3. Stripe webhook confirms payment → Relay provisions subscription
4. Poll \`GET /checkout/intents/{id}\` for status

**What this creates:**
- Locks in pricing at creation time (quote snapshot)
- Creates Stripe PaymentIntent or SetupIntent
- Returns \`clientSecret\` for client-side payment confirmation

**Idempotency:**
Pass \`Idempotency-Key\` header to safely retry. Same key returns existing intent.

**Trial handling:**
- If offer has a trial and no payment required, uses SetupIntent
- If payment required immediately, uses PaymentIntent`,
  })
  @ApiResponse({
    status: 201,
    description: "Checkout intent created with client secret for payment",
    schema: CheckoutIntentSchema,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request or promotion code",
  })
  @ApiResponse({
    status: 409,
    description: "Intent with this idempotency key already exists with different parameters",
  })
  async createIntent(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCheckoutIntentDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.checkoutService.createIntent(workspaceId, dto, idempotencyKey);
  }

  @Get("intents/:id")
  @MemberOnly()
  @ApiOperation({
    summary: "Get checkout intent",
    description: `Retrieves the current status of a checkout intent.

**Use this to:**
- Poll for payment completion after client-side confirmation
- Check intent status before retrying payment
- Get subscription ID after successful payment

**Statuses:**
- \`pending\`: Awaiting payment
- \`processing\`: Payment in progress
- \`requires_action\`: Needs 3D Secure or other authentication
- \`succeeded\`: Payment complete, subscription created
- \`failed\`: Payment failed
- \`expired\`: Intent timed out (24 hours)`,
  })
  @ApiParam({
    name: "id",
    description: "Checkout intent ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Checkout intent details",
    schema: CheckoutIntentSchema,
  })
  @ApiResponse({
    status: 404,
    description: "Checkout intent not found",
  })
  async getIntent(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    const intent = await this.checkoutService.findIntentById(workspaceId, id);
    if (!intent) {
      throw new NotFoundException(`Checkout intent ${id} not found`);
    }
    return intent;
  }
}
