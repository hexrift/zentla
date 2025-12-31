import { Module } from "@nestjs/common";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { StripeSyncService } from "./stripe-sync.service";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [BillingModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, StripeSyncService],
  exports: [WorkspacesService, StripeSyncService],
})
export class WorkspacesModule {}
