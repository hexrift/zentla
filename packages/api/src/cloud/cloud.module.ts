import { Module, Global } from "@nestjs/common";
import { CloudPlansService } from "./cloud-plans.service";
import { CloudSubscriptionsService } from "./cloud-subscriptions.service";
import { CloudUsageService } from "./cloud-usage.service";

@Global()
@Module({
  providers: [CloudPlansService, CloudSubscriptionsService, CloudUsageService],
  exports: [CloudPlansService, CloudSubscriptionsService, CloudUsageService],
})
export class CloudModule {}
