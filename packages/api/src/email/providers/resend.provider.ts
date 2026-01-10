import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from "./email-provider.interface";
import type { AppConfig } from "../../config/configuration";

@Injectable()
export class ResendProvider implements EmailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend: Resend | null;
  private readonly defaultFrom: string;
  private readonly defaultFromName: string;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    const apiKey = this.configService.get("email.resendApiKey", {
      infer: true,
    });

    this.defaultFrom =
      this.configService.get("email.defaultFromEmail", {
        infer: true,
      }) ?? "billing@example.com";

    this.defaultFromName =
      this.configService.get("email.defaultFromName", {
        infer: true,
      }) ?? "Billing Team";

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log("Resend email provider initialized");
    } else {
      this.resend = null;
      this.logger.warn(
        "Resend API key not configured, emails will be logged only",
      );
    }
  }

  isConfigured(): boolean {
    return this.resend !== null;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const from = message.fromName
      ? `${message.fromName} <${message.from ?? this.defaultFrom}>`
      : (message.from ?? `${this.defaultFromName} <${this.defaultFrom}>`);

    if (!this.resend) {
      this.logger.log(`[DRY RUN] Would send email:
        To: ${message.to}
        From: ${from}
        Subject: ${message.subject}
      `);
      return {
        success: true,
        messageId: `dry-run-${Date.now()}`,
      };
    }

    try {
      const result = await this.resend.emails.send({
        from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: message.tags,
      });

      if (result.error) {
        this.logger.error(`Failed to send email: ${result.error.message}`);
        return {
          success: false,
          error: result.error.message,
        };
      }

      this.logger.log(`Email sent successfully: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send email: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
