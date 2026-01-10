import { Module, forwardRef } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhookEndpointsController } from "./webhook-endpoints.controller";
import { WebhooksService } from "./webhooks.service";
import { OutboxService } from "./outbox.service";
import { StripeWebhookService } from "./stripe-webhook.service";
import { ZuoraWebhookService } from "./zuora-webhook.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { RefundsModule } from "../refunds/refunds.module";
import { DunningModule } from "../dunning/dunning.module";

@Module({
  imports: [
    EntitlementsModule,
    InvoicesModule,
    RefundsModule,
    forwardRef(() => DunningModule),
  ],
  controllers: [WebhooksController, WebhookEndpointsController],
  providers: [
    WebhooksService,
    OutboxService,
    StripeWebhookService,
    ZuoraWebhookService,
    WebhookDeliveryService,
  ],
  exports: [
    WebhooksService,
    OutboxService,
    StripeWebhookService,
    ZuoraWebhookService,
    WebhookDeliveryService,
  ],
})
export class WebhooksModule {}
