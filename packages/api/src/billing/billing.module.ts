import { Module, Global } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { ProviderRefService } from "./provider-ref.service";
import { UsagePricingService } from "./usage-pricing.service";
import { HybridPricingService } from "./hybrid-pricing.service";
import { UsageModule } from "../usage/usage.module";

@Global()
@Module({
  imports: [UsageModule],
  providers: [
    BillingService,
    ProviderRefService,
    UsagePricingService,
    HybridPricingService,
  ],
  exports: [
    BillingService,
    ProviderRefService,
    UsagePricingService,
    HybridPricingService,
  ],
})
export class BillingModule {}
