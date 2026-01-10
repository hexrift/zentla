import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { EmailTemplateService } from "./email-template.service";
import { ResendProvider } from "./providers/resend.provider";

@Module({
  providers: [EmailService, EmailTemplateService, ResendProvider],
  exports: [EmailService, EmailTemplateService],
})
export class EmailModule {}
