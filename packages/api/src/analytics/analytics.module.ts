import { Module, Global } from "@nestjs/common";
import { RevenueAnalyticsService } from "./revenue-analytics.service";
import { AnalyticsController } from "./analytics.controller";

@Global()
@Module({
  controllers: [AnalyticsController],
  providers: [RevenueAnalyticsService],
  exports: [RevenueAnalyticsService],
})
export class AnalyticsModule {}
