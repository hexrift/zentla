import { Module, Global } from '@nestjs/common';
import { BillingService } from './billing.service';
import { ProviderRefService } from './provider-ref.service';

@Global()
@Module({
  providers: [BillingService, ProviderRefService],
  exports: [BillingService, ProviderRefService],
})
export class BillingModule {}
