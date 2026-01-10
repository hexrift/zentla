import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, NotFoundException } from "@nestjs/common";
import { CustomerPortalService } from "./customer-portal.service";
import { PrismaService } from "../database/prisma.service";
import { ResendProvider } from "../email/providers/resend.provider";
import { createHash } from "crypto";

describe("CustomerPortalService", () => {
  let service: CustomerPortalService;
  let prisma: {
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    customerPortalMagicLink: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    customerPortalSession: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    workspace: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    invoice: {
      findMany: ReturnType<typeof vi.fn>;
    };
    entitlement: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let resendProvider: {
    send: ReturnType<typeof vi.fn>;
  };

  const mockWorkspaceId = "ws_123";
  const mockCustomerId = "cust_123";
  const mockEmail = "customer@example.com";

  const mockCustomer = {
    id: mockCustomerId,
    workspaceId: mockWorkspaceId,
    email: mockEmail,
    name: "Test Customer",
  };

  const mockWorkspace = {
    id: mockWorkspaceId,
    name: "Test Workspace",
  };

  const mockOffer = {
    id: "offer_123",
    name: "Pro Plan",
  };

  const mockSubscription = {
    id: "sub_123",
    workspaceId: mockWorkspaceId,
    customerId: mockCustomerId,
    status: "active",
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-02-01"),
    cancelAt: null,
    createdAt: new Date("2025-12-01"),
    offer: mockOffer,
  };

  const mockInvoice = {
    id: "inv_123",
    workspaceId: mockWorkspaceId,
    customerId: mockCustomerId,
    amountDue: 2999,
    amountPaid: 2999,
    total: 2999,
    currency: "usd",
    status: "paid",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-02-01"),
    dueDate: new Date("2026-01-15"),
    paidAt: new Date("2026-01-10"),
    providerInvoiceUrl: "https://stripe.com/invoice/123",
    createdAt: new Date("2026-01-01"),
  };

  const mockEntitlement = {
    id: "ent_123",
    workspaceId: mockWorkspaceId,
    customerId: mockCustomerId,
    featureKey: "api_calls",
    value: 10000,
    valueType: "number",
    expiresAt: null,
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      customerPortalMagicLink: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      customerPortalSession: {
        create: vi.fn(),
        findFirst: vi.fn(),
        deleteMany: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
      },
      subscription: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      invoice: {
        findMany: vi.fn(),
      },
      entitlement: {
        findMany: vi.fn(),
      },
    };

    resendProvider = {
      send: vi.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: ResendProvider, useValue: resendProvider },
      ],
    }).compile();

    service = module.get<CustomerPortalService>(CustomerPortalService);
  });

  describe("requestMagicLink", () => {
    it("should send magic link email for existing customer", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.customerPortalMagicLink.create.mockResolvedValue({ id: "link_123" });

      const result = await service.requestMagicLink(
        mockWorkspaceId,
        mockEmail,
        "https://portal.example.com",
      );

      expect(result.success).toBe(true);
      expect(prisma.customerPortalMagicLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          customerId: mockCustomerId,
        }),
      });
      expect(resendProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockEmail,
          subject: expect.stringContaining("Test Workspace"),
        }),
      );
    });

    it("should return success even if customer not found (security)", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      const result = await service.requestMagicLink(
        mockWorkspaceId,
        "unknown@example.com",
        "https://portal.example.com",
      );

      expect(result.success).toBe(true);
      expect(prisma.customerPortalMagicLink.create).not.toHaveBeenCalled();
      expect(resendProvider.send).not.toHaveBeenCalled();
    });

    it("should still succeed if email sending fails", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.customerPortalMagicLink.create.mockResolvedValue({ id: "link_123" });
      resendProvider.send.mockResolvedValue({ success: false, error: "SMTP error" });

      const result = await service.requestMagicLink(
        mockWorkspaceId,
        mockEmail,
        "https://portal.example.com",
      );

      expect(result.success).toBe(true);
    });

    it("should use default portal name if workspace not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.workspace.findUnique.mockResolvedValue(null);
      prisma.customerPortalMagicLink.create.mockResolvedValue({ id: "link_123" });

      await service.requestMagicLink(
        mockWorkspaceId,
        mockEmail,
        "https://portal.example.com",
      );

      expect(resendProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Customer Portal"),
        }),
      );
    });

    it("should create magic link with 15 minute expiry", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.customerPortalMagicLink.create.mockResolvedValue({ id: "link_123" });

      const beforeCall = Date.now();
      await service.requestMagicLink(
        mockWorkspaceId,
        mockEmail,
        "https://portal.example.com",
      );
      const afterCall = Date.now();

      const createCall = prisma.customerPortalMagicLink.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const expectedExpiry = 15 * 60 * 1000; // 15 minutes

      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + expectedExpiry);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + expectedExpiry);
    });
  });

  describe("verifyMagicLink", () => {
    const mockRawToken = "raw_token_123";
    const mockHashedToken = createHash("sha256").update(mockRawToken).digest("hex");

    const mockMagicLink = {
      id: "link_123",
      workspaceId: mockWorkspaceId,
      customerId: mockCustomerId,
      token: mockHashedToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      usedAt: null,
    };

    it("should verify valid magic link and create session", async () => {
      prisma.customerPortalMagicLink.findFirst.mockResolvedValue(mockMagicLink);
      prisma.customerPortalMagicLink.update.mockResolvedValue({ ...mockMagicLink, usedAt: new Date() });
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.customerPortalSession.create.mockResolvedValue({ id: "session_123" });

      const result = await service.verifyMagicLink(
        mockWorkspaceId,
        mockRawToken,
        "192.168.1.1",
        "Mozilla/5.0",
      );

      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken.length).toBe(64); // 32 bytes hex
      expect(result.customer.id).toBe(mockCustomerId);
      expect(result.customer.email).toBe(mockEmail);
      expect(prisma.customerPortalMagicLink.update).toHaveBeenCalledWith({
        where: { id: mockMagicLink.id },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.customerPortalSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          customerId: mockCustomerId,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        }),
      });
    });

    it("should throw UnauthorizedException for invalid token", async () => {
      prisma.customerPortalMagicLink.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyMagicLink(mockWorkspaceId, "invalid_token"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for expired token", async () => {
      prisma.customerPortalMagicLink.findFirst.mockResolvedValue(null); // Query filters out expired

      await expect(
        service.verifyMagicLink(mockWorkspaceId, mockRawToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for already used token", async () => {
      prisma.customerPortalMagicLink.findFirst.mockResolvedValue(null); // Query filters out used

      await expect(
        service.verifyMagicLink(mockWorkspaceId, mockRawToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw NotFoundException if customer deleted after magic link created", async () => {
      prisma.customerPortalMagicLink.findFirst.mockResolvedValue(mockMagicLink);
      prisma.customerPortalMagicLink.update.mockResolvedValue({ ...mockMagicLink, usedAt: new Date() });
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyMagicLink(mockWorkspaceId, mockRawToken),
      ).rejects.toThrow(NotFoundException);
    });

    it("should create session with 7 day expiry", async () => {
      prisma.customerPortalMagicLink.findFirst.mockResolvedValue(mockMagicLink);
      prisma.customerPortalMagicLink.update.mockResolvedValue({ ...mockMagicLink, usedAt: new Date() });
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.customerPortalSession.create.mockResolvedValue({ id: "session_123" });

      const beforeCall = Date.now();
      await service.verifyMagicLink(mockWorkspaceId, mockRawToken);
      const afterCall = Date.now();

      const createCall = prisma.customerPortalSession.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const expectedExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days

      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + expectedExpiry);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + expectedExpiry);
    });
  });

  describe("validateSession", () => {
    const mockSessionToken = "session_token_123";
    const mockHashedToken = createHash("sha256").update(mockSessionToken).digest("hex");

    const mockSession = {
      id: "session_123",
      workspaceId: mockWorkspaceId,
      customerId: mockCustomerId,
      token: mockHashedToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
    };

    it("should validate valid session and return customer", async () => {
      prisma.customerPortalSession.findFirst.mockResolvedValue(mockSession);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await service.validateSession(mockWorkspaceId, mockSessionToken);

      expect(result.customerId).toBe(mockCustomerId);
      expect(result.customer.id).toBe(mockCustomerId);
      expect(result.customer.email).toBe(mockEmail);
      expect(result.customer.name).toBe("Test Customer");
    });

    it("should throw UnauthorizedException for invalid session", async () => {
      prisma.customerPortalSession.findFirst.mockResolvedValue(null);

      await expect(
        service.validateSession(mockWorkspaceId, "invalid_token"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for expired session", async () => {
      prisma.customerPortalSession.findFirst.mockResolvedValue(null); // Query filters out expired

      await expect(
        service.validateSession(mockWorkspaceId, mockSessionToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw NotFoundException if customer deleted", async () => {
      prisma.customerPortalSession.findFirst.mockResolvedValue(mockSession);
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.validateSession(mockWorkspaceId, mockSessionToken),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("logout", () => {
    it("should delete session on logout", async () => {
      prisma.customerPortalSession.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(mockWorkspaceId, "session_token_123");

      expect(prisma.customerPortalSession.deleteMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          token: expect.any(String),
        },
      });
    });

    it("should not throw if session not found", async () => {
      prisma.customerPortalSession.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.logout(mockWorkspaceId, "nonexistent_token"),
      ).resolves.not.toThrow();
    });
  });

  describe("getSubscriptions", () => {
    it("should return customer subscriptions", async () => {
      prisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await service.getSubscriptions(mockWorkspaceId, mockCustomerId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSubscription.id);
      expect(result[0].status).toBe("active");
      expect(result[0].offer.id).toBe(mockOffer.id);
      expect(result[0].offer.name).toBe(mockOffer.name);
      expect(result[0].cancelAt).toBeNull();
    });

    it("should return empty array if no subscriptions", async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getSubscriptions(mockWorkspaceId, mockCustomerId);

      expect(result).toEqual([]);
    });

    it("should return subscriptions ordered by createdAt desc", async () => {
      prisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      await service.getSubscriptions(mockWorkspaceId, mockCustomerId);

      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId, customerId: mockCustomerId },
        orderBy: { createdAt: "desc" },
        include: { offer: { select: { id: true, name: true } } },
      });
    });
  });

  describe("getInvoices", () => {
    it("should return customer invoices", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      const result = await service.getInvoices(mockWorkspaceId, mockCustomerId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockInvoice.id);
      expect(result[0].amountDue).toBe(2999);
      expect(result[0].currency).toBe("usd");
      expect(result[0].status).toBe("paid");
      expect(result[0].providerInvoiceUrl).toBe("https://stripe.com/invoice/123");
    });

    it("should return empty array if no invoices", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.getInvoices(mockWorkspaceId, mockCustomerId);

      expect(result).toEqual([]);
    });

    it("should respect limit parameter", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.getInvoices(mockWorkspaceId, mockCustomerId, 10);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId, customerId: mockCustomerId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });

    it("should use default limit of 20", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.getInvoices(mockWorkspaceId, mockCustomerId);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  describe("getEntitlements", () => {
    it("should return active entitlements", async () => {
      prisma.entitlement.findMany.mockResolvedValue([mockEntitlement]);

      const result = await service.getEntitlements(mockWorkspaceId, mockCustomerId);

      expect(result).toHaveLength(1);
      expect(result[0].featureKey).toBe("api_calls");
      expect(result[0].value).toBe(10000);
      expect(result[0].valueType).toBe("number");
    });

    it("should return empty array if no entitlements", async () => {
      prisma.entitlement.findMany.mockResolvedValue([]);

      const result = await service.getEntitlements(mockWorkspaceId, mockCustomerId);

      expect(result).toEqual([]);
    });

    it("should filter out expired entitlements", async () => {
      prisma.entitlement.findMany.mockResolvedValue([mockEntitlement]);

      await service.getEntitlements(mockWorkspaceId, mockCustomerId);

      expect(prisma.entitlement.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          customerId: mockCustomerId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
        orderBy: { featureKey: "asc" },
      });
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription at period end", async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      prisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAt: mockSubscription.currentPeriodEnd,
      });

      const result = await service.cancelSubscription(
        mockWorkspaceId,
        mockCustomerId,
        mockSubscription.id,
      );

      expect(result.id).toBe(mockSubscription.id);
      expect(result.cancelAt).toEqual(mockSubscription.currentPeriodEnd);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: { cancelAt: mockSubscription.currentPeriodEnd },
        include: { offer: { select: { id: true, name: true } } },
      });
    });

    it("should throw NotFoundException if subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelSubscription(mockWorkspaceId, mockCustomerId, "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if subscription belongs to different customer", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null); // Query filters by customerId

      await expect(
        service.cancelSubscription(mockWorkspaceId, "other_customer", mockSubscription.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("reactivateSubscription", () => {
    const cancelingSubscription = {
      ...mockSubscription,
      cancelAt: new Date("2026-02-01"),
    };

    it("should reactivate a canceling subscription", async () => {
      prisma.subscription.findFirst.mockResolvedValue(cancelingSubscription);
      prisma.subscription.update.mockResolvedValue({
        ...cancelingSubscription,
        cancelAt: null,
      });

      const result = await service.reactivateSubscription(
        mockWorkspaceId,
        mockCustomerId,
        mockSubscription.id,
      );

      expect(result.id).toBe(mockSubscription.id);
      expect(result.cancelAt).toBeNull();
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: { cancelAt: null },
        include: { offer: { select: { id: true, name: true } } },
      });
    });

    it("should throw NotFoundException if subscription not found", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.reactivateSubscription(mockWorkspaceId, mockCustomerId, "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if subscription is not canceling", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null); // Query filters cancelAt: { not: null }

      await expect(
        service.reactivateSubscription(mockWorkspaceId, mockCustomerId, mockSubscription.id),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if subscription is not active", async () => {
      prisma.subscription.findFirst.mockResolvedValue(null); // Query filters status: "active"

      await expect(
        service.reactivateSubscription(mockWorkspaceId, mockCustomerId, mockSubscription.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
