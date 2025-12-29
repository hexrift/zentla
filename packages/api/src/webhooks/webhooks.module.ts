import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhooksService } from './webhooks.service';
import { OutboxService } from './outbox.service';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  controllers: [WebhooksController, WebhookEndpointsController],
  providers: [WebhooksService, OutboxService, StripeWebhookService],
  exports: [WebhooksService, OutboxService, StripeWebhookService],
})
export class WebhooksModule {}
