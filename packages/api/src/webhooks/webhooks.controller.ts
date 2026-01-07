import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../common/decorators";
import { StripeWebhookService } from "./stripe-webhook.service";
import { ZuoraWebhookService } from "./zuora-webhook.service";

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly zuoraWebhookService: ZuoraWebhookService,
  ) {}

  // ============================================================================
  // Provider-Agnostic Routes (Preferred)
  // ============================================================================

  @Post("providers/stripe")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle Stripe webhook",
    description: `Receives and processes webhook events from Stripe.

**Setup in Stripe Dashboard:**
1. Go to Developers > Webhooks
2. Add endpoint: \`https://your-domain.com/api/v1/webhooks/providers/stripe\`
3. Select events to receive

**Required Headers:**
- \`stripe-signature\`: Signature from Stripe for verification

**Supported Events:**
- \`checkout.session.completed\` - Checkout completed, subscription created
- \`customer.subscription.created\` - New subscription
- \`customer.subscription.updated\` - Subscription changed
- \`customer.subscription.deleted\` - Subscription canceled
- \`invoice.paid\` - Payment succeeded
- \`invoice.payment_failed\` - Payment failed

**Security:**
Webhook signatures are verified using the STRIPE_WEBHOOK_SECRET environment variable.`,
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processed successfully",
    schema: {
      type: "object",
      properties: {
        received: { type: "boolean", example: true },
        eventType: { type: "string", example: "checkout.session.completed" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid webhook (signature verification failed or malformed payload)",
  })
  async handleStripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("stripe-signature") signature: string,
  ) {
    return this.processStripeWebhook(req, res, signature);
  }

  @Post("providers/zuora")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle Zuora webhook",
    description: `Receives and processes webhook events from Zuora callout notifications.

**Setup in Zuora:**
1. Go to Settings > Notifications
2. Create a callout notification
3. Set endpoint URL: \`https://your-domain.com/api/v1/webhooks/providers/zuora\`
4. Configure the HMAC signature secret

**Required Headers:**
- \`x-zuora-signature\`: HMAC-SHA256 signature for verification

**Supported Events:**
- \`SubscriptionCreated\` - New subscription created
- \`SubscriptionUpdated\` - Subscription changed
- \`SubscriptionCancelled\` - Subscription canceled
- \`PaymentSuccess\` - Payment succeeded
- \`PaymentFailed\` - Payment failed

**Security:**
Webhook signatures are verified using the workspace's Zuora webhook secret.`,
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processed successfully",
    schema: {
      type: "object",
      properties: {
        received: { type: "boolean", example: true },
        eventId: { type: "string", example: "zuora_evt_123" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid webhook (signature verification failed or malformed payload)",
  })
  async handleZuoraWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("x-zuora-signature") signature: string,
  ) {
    return this.processZuoraWebhook(req, res, signature);
  }

  // ============================================================================
  // Legacy Routes (Deprecated - kept for backward compatibility)
  // These routes will be removed in a future version.
  // Migrate to /webhooks/providers/{provider} endpoints.
  // ============================================================================

  /**
   * @deprecated Use POST /webhooks/providers/stripe instead.
   * This endpoint is maintained for backward compatibility.
   */
  @Post("stripe")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Hide from API docs
  async handleStripeWebhookLegacy(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("stripe-signature") signature: string,
  ) {
    return this.processStripeWebhook(req, res, signature);
  }

  /**
   * @deprecated Use POST /webhooks/providers/zuora instead.
   */
  @Post("zuora")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleZuoraWebhookLegacy(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("x-zuora-signature") signature: string,
  ) {
    return this.processZuoraWebhook(req, res, signature);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async processStripeWebhook(
    req: Request,
    res: Response,
    signature: string,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException("Missing raw body");
    }

    if (!signature) {
      throw new BadRequestException("Missing Stripe signature");
    }

    try {
      const result = await this.stripeWebhookService.processWebhook(
        rawBody,
        signature,
      );
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error}`);
      if (
        error instanceof Error &&
        error.message === "Invalid webhook signature"
      ) {
        res.status(400).json({ error: "Invalid signature" });
      } else {
        // Return 500 so Stripe will retry
        res.status(500).json({ error: "Processing failed" });
      }
    }
  }

  private async processZuoraWebhook(
    req: Request,
    res: Response,
    signature: string,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException("Missing raw body");
    }

    // Zuora signature is optional if not configured
    // The service will handle verification based on workspace settings

    try {
      const result = await this.zuoraWebhookService.processWebhook(
        rawBody,
        signature || "",
      );
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error}`);
      if (
        error instanceof Error &&
        error.message === "Invalid webhook signature"
      ) {
        res.status(400).json({ error: "Invalid signature" });
      } else if (
        error instanceof Error &&
        error.message === "Invalid webhook payload"
      ) {
        res.status(400).json({ error: "Invalid payload" });
      } else {
        // Return 500 so Zuora will retry
        res.status(500).json({ error: "Processing failed" });
      }
    }
  }
}
