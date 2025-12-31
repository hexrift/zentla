import { Module, forwardRef } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { OffersModule } from "../offers/offers.module";

@Module({
  imports: [forwardRef(() => OffersModule)],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
