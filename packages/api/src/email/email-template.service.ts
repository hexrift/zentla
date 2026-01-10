import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { DunningEmailType } from "@prisma/client";

export interface TemplateVariables {
  customerName?: string;
  customerEmail?: string;
  invoiceAmount?: string;
  invoiceCurrency?: string;
  invoiceNumber?: string;
  attemptNumber?: number;
  maxAttempts?: number;
  nextRetryDate?: string;
  updatePaymentUrl?: string;
  companyName?: string;
  supportEmail?: string;
}

interface RenderedTemplate {
  subject: string;
  html: string;
  text?: string;
}

const DEFAULT_TEMPLATES: Record<
  DunningEmailType,
  { subject: string; html: string; text: string }
> = {
  payment_failed: {
    subject: "Action Required: Payment Failed for Invoice {{invoiceNumber}}",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Failed</h2>
        <p>Hi {{customerName}},</p>
        <p>We were unable to process the payment for your invoice <strong>{{invoiceNumber}}</strong> in the amount of <strong>{{invoiceAmount}} {{invoiceCurrency}}</strong>.</p>
        <p>Please update your payment method to avoid any interruption to your service.</p>
        {{#if updatePaymentUrl}}
        <p><a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Update Payment Method</a></p>
        {{/if}}
        <p>We'll automatically retry the payment in a few days.</p>
        <p>If you have any questions, please contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>{{companyName}}</p>
      </div>
    `,
    text: `Payment Failed

Hi {{customerName}},

We were unable to process the payment for your invoice {{invoiceNumber}} in the amount of {{invoiceAmount}} {{invoiceCurrency}}.

Please update your payment method to avoid any interruption to your service.
{{#if updatePaymentUrl}}
Update your payment method: {{updatePaymentUrl}}
{{/if}}

We'll automatically retry the payment in a few days.

If you have any questions, please contact us at {{supportEmail}}.

Best regards,
{{companyName}}`,
  },
  payment_reminder: {
    subject: "Payment Reminder: Invoice {{invoiceNumber}} Still Outstanding",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Reminder</h2>
        <p>Hi {{customerName}},</p>
        <p>This is a reminder that your invoice <strong>{{invoiceNumber}}</strong> for <strong>{{invoiceAmount}} {{invoiceCurrency}}</strong> remains unpaid.</p>
        <p>We've attempted to charge your payment method {{attemptNumber}} time(s).</p>
        <p>Please update your payment information to continue your service.</p>
        {{#if updatePaymentUrl}}
        <p><a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Update Payment Method</a></p>
        {{/if}}
        <p>We'll try again on {{nextRetryDate}}.</p>
        <p>Best regards,<br>{{companyName}}</p>
      </div>
    `,
    text: `Payment Reminder

Hi {{customerName}},

This is a reminder that your invoice {{invoiceNumber}} for {{invoiceAmount}} {{invoiceCurrency}} remains unpaid.

We've attempted to charge your payment method {{attemptNumber}} time(s).

Please update your payment information to continue your service.
{{#if updatePaymentUrl}}
Update your payment method: {{updatePaymentUrl}}
{{/if}}

We'll try again on {{nextRetryDate}}.

Best regards,
{{companyName}}`,
  },
  final_warning: {
    subject: "Final Notice: Service May Be Suspended",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Final Payment Notice</h2>
        <p>Hi {{customerName}},</p>
        <p>Despite our previous attempts, we've been unable to process your payment for invoice <strong>{{invoiceNumber}}</strong> ({{invoiceAmount}} {{invoiceCurrency}}).</p>
        <p><strong>This is our final attempt.</strong> If payment fails, your service will be suspended.</p>
        <p>Please update your payment method immediately to avoid interruption.</p>
        {{#if updatePaymentUrl}}
        <p><a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 6px;">Update Payment Method Now</a></p>
        {{/if}}
        <p>If you believe this is an error or need assistance, please contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>{{companyName}}</p>
      </div>
    `,
    text: `FINAL PAYMENT NOTICE

Hi {{customerName}},

Despite our previous attempts, we've been unable to process your payment for invoice {{invoiceNumber}} ({{invoiceAmount}} {{invoiceCurrency}}).

THIS IS OUR FINAL ATTEMPT. If payment fails, your service will be suspended.

Please update your payment method immediately to avoid interruption.
{{#if updatePaymentUrl}}
Update your payment method now: {{updatePaymentUrl}}
{{/if}}

If you believe this is an error or need assistance, please contact us at {{supportEmail}}.

Best regards,
{{companyName}}`,
  },
  subscription_suspended: {
    subject: "Your Subscription Has Been Suspended",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Subscription Suspended</h2>
        <p>Hi {{customerName}},</p>
        <p>Unfortunately, we were unable to collect payment for your subscription after multiple attempts.</p>
        <p>Your subscription has been <strong>suspended</strong> effective immediately.</p>
        <p>To reactivate your service, please update your payment method and pay the outstanding invoice of <strong>{{invoiceAmount}} {{invoiceCurrency}}</strong>.</p>
        {{#if updatePaymentUrl}}
        <p><a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Reactivate My Subscription</a></p>
        {{/if}}
        <p>If you have any questions, please contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>{{companyName}}</p>
      </div>
    `,
    text: `Subscription Suspended

Hi {{customerName}},

Unfortunately, we were unable to collect payment for your subscription after multiple attempts.

Your subscription has been SUSPENDED effective immediately.

To reactivate your service, please update your payment method and pay the outstanding invoice of {{invoiceAmount}} {{invoiceCurrency}}.
{{#if updatePaymentUrl}}
Reactivate your subscription: {{updatePaymentUrl}}
{{/if}}

If you have any questions, please contact us at {{supportEmail}}.

Best regards,
{{companyName}}`,
  },
  subscription_canceled: {
    subject: "Your Subscription Has Been Canceled",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Subscription Canceled</h2>
        <p>Hi {{customerName}},</p>
        <p>Unfortunately, we were unable to collect payment for your subscription after multiple attempts.</p>
        <p>Your subscription has been <strong>canceled</strong> effective immediately.</p>
        <p>If you'd like to resubscribe, you can start a new subscription at any time.</p>
        {{#if updatePaymentUrl}}
        <p><a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Start New Subscription</a></p>
        {{/if}}
        <p>If you have any questions, please contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>{{companyName}}</p>
      </div>
    `,
    text: `Subscription Canceled

Hi {{customerName}},

Unfortunately, we were unable to collect payment for your subscription after multiple attempts.

Your subscription has been CANCELED effective immediately.

If you'd like to resubscribe, you can start a new subscription at any time.
{{#if updatePaymentUrl}}
Start a new subscription: {{updatePaymentUrl}}
{{/if}}

If you have any questions, please contact us at {{supportEmail}}.

Best regards,
{{companyName}}`,
  },
  payment_recovered: {
    subject: "Good News: Payment Received!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Payment Successful!</h2>
        <p>Hi {{customerName}},</p>
        <p>Great news! We've successfully processed your payment for invoice <strong>{{invoiceNumber}}</strong> in the amount of <strong>{{invoiceAmount}} {{invoiceCurrency}}</strong>.</p>
        <p>Your subscription is now active and in good standing.</p>
        <p>Thank you for your continued business!</p>
        <p>Best regards,<br>{{companyName}}</p>
      </div>
    `,
    text: `Payment Successful!

Hi {{customerName}},

Great news! We've successfully processed your payment for invoice {{invoiceNumber}} in the amount of {{invoiceAmount}} {{invoiceCurrency}}.

Your subscription is now active and in good standing.

Thank you for your continued business!

Best regards,
{{companyName}}`,
  },
};

@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async renderTemplate(
    dunningConfigId: string | null,
    type: DunningEmailType,
    variables: TemplateVariables,
  ): Promise<RenderedTemplate> {
    let template = DEFAULT_TEMPLATES[type];

    // Try to get custom template if dunning config exists
    if (dunningConfigId) {
      const customTemplate = await this.prisma.dunningEmailTemplate.findUnique({
        where: {
          dunningConfigId_type: {
            dunningConfigId,
            type,
          },
        },
      });

      if (customTemplate?.enabled) {
        template = {
          subject: customTemplate.subject,
          html: customTemplate.bodyHtml,
          text: customTemplate.bodyText ?? "",
        };
      }
    }

    return {
      subject: this.interpolate(template.subject, variables),
      html: this.interpolate(template.html, variables),
      text: template.text
        ? this.interpolate(template.text, variables)
        : undefined,
    };
  }

  getDefaultTemplate(type: DunningEmailType): {
    subject: string;
    html: string;
    text: string;
  } {
    return DEFAULT_TEMPLATES[type];
  }

  private interpolate(template: string, variables: TemplateVariables): string {
    let result = template;

    // Handle simple variable substitution {{varName}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, String(value ?? ""));
    }

    // Handle conditional blocks {{#if varName}}...{{/if}}
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => {
        const value = variables[varName as keyof TemplateVariables];
        return value ? content : "";
      },
    );

    return result;
  }
}
