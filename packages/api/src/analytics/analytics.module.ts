import { Module, Global } from "@nestjs/common";
import { RevenueAnalyticsService } from "./revenue-analytics.service";

@Global()
@Module({
  providers: [RevenueAnalyticsService],
  exports: [RevenueAnalyticsService],
})
export class AnalyticsModule {}
