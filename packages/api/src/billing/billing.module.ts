import { Module, Global } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { ProviderRefService } from "./provider-ref.service";
import { UsagePricingService } from "./usage-pricing.service";
import { UsageModule } from "../usage/usage.module";

@Global()
@Module({
  imports: [UsageModule],
  providers: [BillingService, ProviderRefService, UsagePricingService],
  exports: [BillingService, ProviderRefService, UsagePricingService],
})
export class BillingModule {}
