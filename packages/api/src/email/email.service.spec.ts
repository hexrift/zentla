import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "./email.service";
import { EmailTemplateService } from "./email-template.service";
import { ResendProvider } from "./providers/resend.provider";
import { PrismaService } from "../database/prisma.service";

describe("EmailService", () => {
  let service: EmailService;
  let prisma: {
    customer: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    emailNotification: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let templateService: {
    renderTemplate: ReturnType<typeof vi.fn>;
  };
  let resendProvider: {
    send: ReturnType<typeof vi.fn>;
    isConfigured: ReturnType<typeof vi.fn>;
  };
  let configService: {
    get: ReturnType<typeof vi.fn>;
  };

  const mockWorkspaceId = "ws_123";
  const mockCustomerId = "cust_123";
  const mockInvoiceId = "inv_123";

  const mockCustomer = {
    id: mockCustomerId,
    email: "customer@example.com",
    name: "Test Customer",
  };

  const mockRenderedTemplate = {
    subject: "Payment Failed",
    html: "<p>Your payment failed</p>",
    text: "Your payment failed",
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        findUnique: vi.fn(),
      },
      emailNotification: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    templateService = {
      renderTemplate: vi.fn(),
    };

    resendProvider = {
      send: vi.fn(),
      isConfigured: vi.fn(),
    };

    configService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailTemplateService, useValue: templateService },
        { provide: ResendProvider, useValue: resendProvider },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe("isConfigured", () => {
    it("should return true when provider is configured", () => {
      resendProvider.isConfigured.mockReturnValue(true);

      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when provider is not configured", () => {
      resendProvider.isConfigured.mockReturnValue(false);

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("sendDunningEmail", () => {
    it("should send dunning email successfully", async () => {
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      templateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
      prisma.emailNotification.create.mockResolvedValue({
        id: "notif_123",
      });
      resendProvider.send.mockResolvedValue({
        messageId: "msg_123",
        success: true,
      });
      configService.get
        .mockReturnValueOnce("billing@example.com")
        .mockReturnValueOnce("Billing Team");

      const result = await service.sendDunningEmail({
        workspaceId: mockWorkspaceId,
        customerId: mockCustomerId,
        invoiceId: mockInvoiceId,
        dunningConfigId: "config_123",
        type: "payment_failed",
        variables: {
          customerName: "Test",
          customerEmail: "test@example.com",
          invoiceAmount: "$10.00",
          invoiceCurrency: "USD",
        },
      });

      expect(result).toBe("notif_123");
      expect(templateService.renderTemplate).toHaveBeenCalledWith(
        "config_123",
        "payment_failed",
        expect.any(Object),
      );
      expect(resendProvider.send).toHaveBeenCalled();
      expect(prisma.emailNotification.update).toHaveBeenCalledWith({
        where: { id: "notif_123" },
        data: {
          status: "sent",
          providerMessageId: "msg_123",
          sentAt: expect.any(Date),
          failureReason: undefined,
        },
      });
    });

    it("should handle provider failure", async () => {
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      templateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
      prisma.emailNotification.create.mockResolvedValue({
        id: "notif_123",
      });
      resendProvider.send.mockResolvedValue({
        success: false,
        error: "Rate limited",
      });
      configService.get
        .mockReturnValueOnce("billing@example.com")
        .mockReturnValueOnce("Billing Team");

      const result = await service.sendDunningEmail({
        workspaceId: mockWorkspaceId,
        customerId: mockCustomerId,
        invoiceId: mockInvoiceId,
        dunningConfigId: undefined,
        type: "payment_reminder",
        variables: {},
      });

      expect(result).toBe("notif_123");
      expect(prisma.emailNotification.update).toHaveBeenCalledWith({
        where: { id: "notif_123" },
        data: expect.objectContaining({
          status: "failed",
          failureReason: "Rate limited",
        }),
      });
    });

    it("should throw error when customer has no email", async () => {
      prisma.customer.findUnique.mockResolvedValue({
        email: null,
        name: "Test",
      });

      await expect(
        service.sendDunningEmail({
          workspaceId: mockWorkspaceId,
          customerId: mockCustomerId,
          invoiceId: mockInvoiceId,
          dunningConfigId: undefined,
          type: "payment_failed",
          variables: {},
        }),
      ).rejects.toThrow("has no email address");
    });

    it("should use custom from email when provided", async () => {
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      templateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
      prisma.emailNotification.create.mockResolvedValue({
        id: "notif_123",
      });
      resendProvider.send.mockResolvedValue({
        messageId: "msg_123",
        success: true,
      });

      await service.sendDunningEmail({
        workspaceId: mockWorkspaceId,
        customerId: mockCustomerId,
        invoiceId: mockInvoiceId,
        dunningConfigId: undefined,
        type: "payment_failed",
        variables: {},
        fromEmail: "custom@example.com",
        fromName: "Custom Sender",
      });

      expect(resendProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining("custom@example.com"),
        }),
      );
    });

    it("should include reply-to when provided", async () => {
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      templateService.renderTemplate.mockResolvedValue(mockRenderedTemplate);
      prisma.emailNotification.create.mockResolvedValue({
        id: "notif_123",
      });
      resendProvider.send.mockResolvedValue({
        messageId: "msg_123",
        success: true,
      });
      configService.get
        .mockReturnValueOnce("billing@example.com")
        .mockReturnValueOnce("Billing Team");

      await service.sendDunningEmail({
        workspaceId: mockWorkspaceId,
        customerId: mockCustomerId,
        invoiceId: mockInvoiceId,
        dunningConfigId: undefined,
        type: "payment_failed",
        variables: {},
        replyToEmail: "support@example.com",
      });

      expect(resendProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "support@example.com",
        }),
      );
    });
  });
});
