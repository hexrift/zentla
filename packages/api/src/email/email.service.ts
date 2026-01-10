import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ResendProvider } from "./providers/resend.provider";
import {
  EmailTemplateService,
  type TemplateVariables,
} from "./email-template.service";
import type { DunningEmailType, EmailNotificationStatus } from "@prisma/client";

export interface SendDunningEmailParams {
  workspaceId: string;
  customerId: string;
  invoiceId: string;
  dunningConfigId?: string;
  type: DunningEmailType;
  variables: TemplateVariables;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resendProvider: ResendProvider,
    private readonly templateService: EmailTemplateService,
  ) {}

  async sendDunningEmail(params: SendDunningEmailParams): Promise<string> {
    const {
      workspaceId,
      customerId,
      invoiceId,
      dunningConfigId,
      type,
      variables,
      fromEmail,
      fromName,
      replyToEmail,
    } = params;

    // Get customer email
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true, name: true },
    });

    if (!customer?.email) {
      throw new Error(`Customer ${customerId} has no email address`);
    }

    // Render template
    const rendered = await this.templateService.renderTemplate(
      dunningConfigId ?? null,
      type,
      {
        ...variables,
        customerName: variables.customerName ?? customer.name ?? "Customer",
        customerEmail: customer.email,
      },
    );

    // Create notification record
    const notification = await this.prisma.emailNotification.create({
      data: {
        workspaceId,
        customerId,
        invoiceId,
        type,
        toEmail: customer.email,
        status: "pending",
      },
    });

    // Send email
    const result = await this.resendProvider.send({
      to: customer.email,
      from: fromEmail,
      fromName,
      replyTo: replyToEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: "type", value: type },
        { name: "workspaceId", value: workspaceId },
        { name: "invoiceId", value: invoiceId },
      ],
    });

    // Update notification status
    const newStatus: EmailNotificationStatus = result.success
      ? "sent"
      : "failed";
    await this.prisma.emailNotification.update({
      where: { id: notification.id },
      data: {
        status: newStatus,
        providerMessageId: result.messageId,
        sentAt: result.success ? new Date() : null,
        failureReason: result.error,
      },
    });

    if (!result.success) {
      this.logger.warn(
        `Failed to send dunning email ${type} to ${customer.email}: ${result.error}`,
      );
    } else {
      this.logger.log(
        `Sent dunning email ${type} to ${customer.email} (${result.messageId})`,
      );
    }

    return notification.id;
  }

  async getNotificationsByInvoice(
    workspaceId: string,
    invoiceId: string,
  ): Promise<
    Array<{
      id: string;
      type: DunningEmailType;
      toEmail: string;
      status: EmailNotificationStatus;
      sentAt: Date | null;
      createdAt: Date;
    }>
  > {
    return this.prisma.emailNotification.findMany({
      where: { workspaceId, invoiceId },
      select: {
        id: true,
        type: true,
        toEmail: true,
        status: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  isConfigured(): boolean {
    return this.resendProvider.isConfigured();
  }
}
