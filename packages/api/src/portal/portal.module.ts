import { Module } from "@nestjs/common";
import { CustomerPortalController } from "./customer-portal.controller";
import { CustomerPortalService } from "./customer-portal.service";
import { CustomersModule } from "../customers/customers.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [CustomersModule, EmailModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
  exports: [CustomerPortalService],
})
export class PortalModule {}
