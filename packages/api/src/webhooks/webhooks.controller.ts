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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators';
import { StripeWebhookService } from './stripe-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post('stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook' })
  async handleStripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    try {
      const result = await this.stripeWebhookService.processWebhook(
        rawBody,
        signature
      );
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error}`);
      if (error instanceof Error && error.message === 'Invalid webhook signature') {
        res.status(400).json({ error: 'Invalid signature' });
      } else {
        // Return 500 so Stripe will retry
        res.status(500).json({ error: 'Processing failed' });
      }
    }
  }

  @Post('zuora')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleZuoraWebhook(
    @Req() _req: Request,
    @Res() res: Response
  ) {
    // Zuora webhook handler stub
    res.status(200).json({ received: true });
  }
}
