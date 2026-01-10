import { Module, forwardRef } from "@nestjs/common";
import { DunningController } from "./dunning.controller";
import { DunningService } from "./dunning.service";
import { DunningSchedulerService } from "./dunning-scheduler.service";
import { DunningConfigService } from "./dunning-config.service";
import { BillingModule } from "../billing/billing.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [BillingModule, forwardRef(() => WebhooksModule), EmailModule],
  controllers: [DunningController],
  providers: [DunningService, DunningSchedulerService, DunningConfigService],
  exports: [DunningService, DunningConfigService],
})
export class DunningModule {}
