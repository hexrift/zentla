import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhooksService } from './webhooks.service';
import { OutboxService } from './outbox.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [EntitlementsModule],
  controllers: [WebhooksController, WebhookEndpointsController],
  providers: [
    WebhooksService,
    OutboxService,
    StripeWebhookService,
    WebhookDeliveryService,
  ],
  exports: [WebhooksService, OutboxService, StripeWebhookService, WebhookDeliveryService],
})
export class WebhooksModule {}
