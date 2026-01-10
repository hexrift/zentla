import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { EmailTemplateService } from "./email-template.service";
import { PrismaService } from "../database/prisma.service";

describe("EmailTemplateService", () => {
  let service: EmailTemplateService;
  let prisma: {
    dunningEmailTemplate: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      dunningEmailTemplate: {
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
  });

  describe("renderTemplate", () => {
    it("should render default template when no custom template exists", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate(null, "payment_failed", {
        customerName: "John Doe",
        invoiceAmount: "$100.00",
        invoiceCurrency: "USD",
        companyName: "Acme Inc",
        supportEmail: "support@acme.com",
      });

      expect(result.subject).toContain("Action Required: Payment Failed");
      expect(result.html).toContain("John Doe");
      expect(result.html).toContain("$100.00");
      expect(result.text).toContain("John Doe");
    });

    it("should render custom template when available", async () => {
      const customTemplate = {
        id: "template_123",
        dunningConfigId: "config_123",
        type: "payment_failed",
        subject: "Custom Subject for {{customerName}}",
        bodyHtml: "<p>Custom body for {{invoiceAmount}}</p>",
        bodyText: "Custom text for {{invoiceAmount}}",
        enabled: true,
      };
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(customTemplate);

      const result = await service.renderTemplate(
        "config_123",
        "payment_failed",
        {
          customerName: "Jane Doe",
          invoiceAmount: "$200.00",
        },
      );

      expect(result.subject).toBe("Custom Subject for Jane Doe");
      expect(result.html).toBe("<p>Custom body for $200.00</p>");
      expect(result.text).toBe("Custom text for $200.00");
    });

    it("should fall back to default if custom template disabled", async () => {
      const disabledTemplate = {
        id: "template_123",
        dunningConfigId: "config_123",
        type: "payment_failed",
        subject: "Disabled Subject",
        bodyHtml: "<p>Disabled body</p>",
        bodyText: "Disabled text",
        enabled: false,
      };
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(
        disabledTemplate,
      );

      const result = await service.renderTemplate(
        "config_123",
        "payment_failed",
        {
          customerName: "Test User",
          invoiceAmount: "$50.00",
          invoiceCurrency: "USD",
          companyName: "Test Co",
          supportEmail: "test@test.com",
        },
      );

      // Should use default template
      expect(result.subject).toContain("Action Required: Payment Failed");
    });

    it("should handle payment_reminder template", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate(null, "payment_reminder", {
        customerName: "Test",
        invoiceAmount: "$75.00",
        invoiceCurrency: "USD",
        attemptNumber: 2,
        maxAttempts: 4,
        nextRetryDate: "2025-01-15",
        companyName: "Company",
        supportEmail: "support@company.com",
      });

      expect(result.subject).toContain("Payment Reminder");
      expect(result.html).toContain("Test");
      expect(result.html).toContain("2");
    });

    it("should handle final_warning template", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate(null, "final_warning", {
        customerName: "Test",
        invoiceAmount: "$100.00",
        invoiceCurrency: "USD",
        companyName: "Company",
        supportEmail: "support@company.com",
      });

      expect(result.subject).toContain("Final Notice");
      expect(result.html).toContain("Final Payment Notice");
    });

    it("should handle subscription_suspended template", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate(
        null,
        "subscription_suspended",
        {
          customerName: "Test",
          invoiceAmount: "$100.00",
          invoiceCurrency: "USD",
          companyName: "Company",
          supportEmail: "support@company.com",
        },
      );

      expect(result.subject).toBe("Your Subscription Has Been Suspended");
      expect(result.html).toContain("Suspended");
    });

    it("should handle subscription_canceled template", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate(
        null,
        "subscription_canceled",
        {
          customerName: "Test",
          invoiceAmount: "$100.00",
          invoiceCurrency: "USD",
          companyName: "Company",
          supportEmail: "support@company.com",
        },
      );

      expect(result.subject).toBe("Your Subscription Has Been Canceled");
      expect(result.html).toContain("Canceled");
    });

    it("should handle payment_recovered template", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate(null, "payment_recovered", {
        customerName: "Test",
        invoiceAmount: "$100.00",
        invoiceCurrency: "USD",
        invoiceNumber: "INV-123",
        companyName: "Company",
      });

      expect(result.subject).toBe("Good News: Payment Received!");
      expect(result.html).toContain("Payment Successful");
      expect(result.html).toContain("INV-123");
    });

    it("should handle conditional blocks", async () => {
      prisma.dunningEmailTemplate.findUnique.mockResolvedValue(null);

      const resultWithUrl = await service.renderTemplate(
        null,
        "payment_failed",
        {
          customerName: "Test",
          invoiceAmount: "$100.00",
          invoiceCurrency: "USD",
          updatePaymentUrl: "https://example.com/update",
          companyName: "Company",
          supportEmail: "support@company.com",
        },
      );

      expect(resultWithUrl.html).toContain("https://example.com/update");

      const resultWithoutUrl = await service.renderTemplate(
        null,
        "payment_failed",
        {
          customerName: "Test",
          invoiceAmount: "$100.00",
          invoiceCurrency: "USD",
          companyName: "Company",
          supportEmail: "support@company.com",
        },
      );

      expect(resultWithoutUrl.html).not.toContain("href=");
    });
  });
});
