import { Module } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { OffersModule } from "../offers/offers.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";

@Module({
  imports: [OffersModule, EntitlementsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
