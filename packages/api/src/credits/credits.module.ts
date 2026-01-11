import { Module } from "@nestjs/common";
import { CreditsController } from "./credits.controller";
import { CreditsService } from "./credits.service";
import { CreditsSchedulerService } from "./credits-scheduler.service";

@Module({
  controllers: [CreditsController],
  providers: [CreditsService, CreditsSchedulerService],
  exports: [CreditsService],
})
export class CreditsModule {}
