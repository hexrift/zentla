import { Module } from "@nestjs/common";
import { EntitlementsController } from "./entitlements.controller";
import { EntitlementsService } from "./entitlements.service";
import { EnforcementService } from "./enforcement.service";
import { EnforcementGuard } from "./guards/enforcement.guard";
import { SeatsService } from "./seats.service";
import { UsageModule } from "../usage/usage.module";

@Module({
  imports: [UsageModule],
  controllers: [EntitlementsController],
  providers: [
    EntitlementsService,
    EnforcementService,
    EnforcementGuard,
    SeatsService,
  ],
  exports: [
    EntitlementsService,
    EnforcementService,
    EnforcementGuard,
    SeatsService,
  ],
})
export class EntitlementsModule {}
