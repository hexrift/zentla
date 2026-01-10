export { EmailModule } from "./email.module";
export { EmailService, type SendDunningEmailParams } from "./email.service";
export {
  EmailTemplateService,
  type TemplateVariables,
} from "./email-template.service";
export { ResendProvider } from "./providers/resend.provider";
export type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from "./providers/email-provider.interface";
