import { Module, Global } from "@nestjs/common";
import { RevenueAnalyticsService } from "./revenue-analytics.service";
import { DunningAnalyticsService } from "./dunning-analytics.service";
import { AnalyticsController } from "./analytics.controller";

@Global()
@Module({
  controllers: [AnalyticsController],
  providers: [RevenueAnalyticsService, DunningAnalyticsService],
  exports: [RevenueAnalyticsService, DunningAnalyticsService],
})
export class AnalyticsModule {}
