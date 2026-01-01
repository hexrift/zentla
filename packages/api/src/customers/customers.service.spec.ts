import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import { ProviderRefService } from "../billing/provider-ref.service";

describe("CustomersService", () => {
  let service: CustomersService;
  let prisma: {
    customer: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let billingService: {
    isConfigured: ReturnType<typeof vi.fn>;
    getProvider: ReturnType<typeof vi.fn>;
  };
  let providerRefService: {
    getProviderCustomerId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const mockCustomer = {
    id: "cust_123",
    workspaceId: "ws_123",
    email: "test@example.com",
    name: "Test User",
    externalId: "ext_123",
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    billingService = {
      isConfigured: vi.fn().mockReturnValue(true),
      getProvider: vi.fn().mockReturnValue({
        createCustomer: vi
          .fn()
          .mockResolvedValue({ externalId: "stripe_cust_123" }),
        updateCustomer: vi.fn().mockResolvedValue({}),
        deleteCustomer: vi.fn().mockResolvedValue({}),
        createPortalSession: vi
          .fn()
          .mockResolvedValue({ id: "ps_123", url: "https://portal.stripe.com" }),
      }),
    };

    providerRefService = {
      getProviderCustomerId: vi.fn().mockResolvedValue("stripe_cust_123"),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
        { provide: ProviderRefService, useValue: providerRefService },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe("findById", () => {
    it("should return customer when found", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.findById("ws_123", "cust_123");

      expect(result).toEqual(mockCustomer);
    });

    it("should return null when not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      const result = await service.findById("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should return customer when found", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.findByEmail("ws_123", "test@example.com");

      expect(result).toEqual(mockCustomer);
    });
  });

  describe("findByExternalId", () => {
    it("should return customer when found", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.findByExternalId("ws_123", "ext_123");

      expect(result).toEqual(mockCustomer);
    });
  });

  describe("findMany", () => {
    it("should return paginated customers", async () => {
      const customers = [mockCustomer, { ...mockCustomer, id: "cust_456" }];
      prisma.customer.findMany.mockResolvedValue(customers);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by email", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, email: "test" });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: { contains: "test", mode: "insensitive" },
          }),
        }),
      );
    });

    it("should filter by externalId", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.findMany("ws_123", { limit: 10, externalId: "ext_123" });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ externalId: "ext_123" }),
        }),
      );
    });

    it("should indicate hasMore when more results exist", async () => {
      const customers = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockCustomer, id: `cust_${i}` }));
      prisma.customer.findMany.mockResolvedValue(customers);

      const result = await service.findMany("ws_123", { limit: 10 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(10);
    });
  });

  describe("create", () => {
    it("should throw ConflictException if email exists", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      await expect(
        service.create("ws_123", { email: "test@example.com" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException if externalId exists", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(mockCustomer); // externalId check

      await expect(
        service.create("ws_123", {
          email: "new@example.com",
          externalId: "ext_123",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should create customer and sync to provider", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.create("ws_123", {
        email: "test@example.com",
        name: "Test User",
      });

      expect(result).toEqual(mockCustomer);
      expect(providerRefService.create).toHaveBeenCalled();
    });

    it("should continue if provider sync fails", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue(mockCustomer);
      billingService.getProvider.mockReturnValue({
        createCustomer: vi.fn().mockRejectedValue(new Error("Provider error")),
      });

      const result = await service.create("ws_123", {
        email: "test@example.com",
      });

      expect(result).toEqual(mockCustomer);
    });
  });

  describe("update", () => {
    it("should throw NotFoundException when customer not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update("ws_123", "nonexistent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException on version mismatch", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      await expect(
        service.update("ws_123", "cust_123", { name: "New Name" }, 999),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException if new email already exists", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockCustomer) // find customer
        .mockResolvedValueOnce({ ...mockCustomer, id: "other" }); // email exists

      await expect(
        service.update("ws_123", "cust_123", { email: "other@example.com" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should update customer", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockCustomer) // find customer
        .mockResolvedValueOnce(null); // email check
      prisma.customer.update.mockResolvedValue({
        ...mockCustomer,
        name: "Updated Name",
        version: 2,
      });

      const result = await service.update("ws_123", "cust_123", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.version).toBe(2);
    });
  });

  describe("delete", () => {
    it("should throw NotFoundException when customer not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.delete("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should delete customer and sync to provider", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.customer.delete.mockResolvedValue(mockCustomer);

      await service.delete("ws_123", "cust_123");

      expect(prisma.customer.delete).toHaveBeenCalledWith({
        where: { id: "cust_123" },
      });
      expect(providerRefService.delete).toHaveBeenCalled();
    });
  });

  describe("getOrCreate", () => {
    it("should return existing customer", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.getOrCreate(
        "ws_123",
        "test@example.com",
        "Test",
      );

      expect(result).toEqual(mockCustomer);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it("should create new customer if not exists", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(null) // getOrCreate check
        .mockResolvedValueOnce(null) // create email check
        .mockResolvedValueOnce(null); // create externalId check (not applicable but still called)
      prisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.getOrCreate(
        "ws_123",
        "test@example.com",
        "Test",
      );

      expect(result).toEqual(mockCustomer);
    });
  });

  describe("createPortalSession", () => {
    it("should throw NotFoundException when customer not found", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.createPortalSession(
          "ws_123",
          "nonexistent",
          "https://example.com",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when no provider customer", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      providerRefService.getProviderCustomerId.mockResolvedValue(null);

      await expect(
        service.createPortalSession(
          "ws_123",
          "cust_123",
          "https://example.com",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should create portal session", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.createPortalSession(
        "ws_123",
        "cust_123",
        "https://example.com",
      );

      expect(result.id).toBe("ps_123");
      expect(result.url).toBe("https://portal.stripe.com");
    });

  });

  describe("update with provider sync", () => {
    it("should sync updated customer to provider when configured", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(null);
      prisma.customer.update.mockResolvedValue({
        ...mockCustomer,
        name: "Updated Name",
        version: 2,
      });

      await service.update("ws_123", "cust_123", { name: "Updated Name" });

      const provider = billingService.getProvider();
      expect(provider.updateCustomer).toHaveBeenCalledWith(
        "stripe_cust_123",
        expect.objectContaining({ name: "Updated Name" }),
      );
    });

    it("should continue if provider update fails", async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(null);
      prisma.customer.update.mockResolvedValue({
        ...mockCustomer,
        name: "Updated Name",
        version: 2,
      });
      billingService.getProvider.mockReturnValue({
        updateCustomer: vi.fn().mockRejectedValue(new Error("Provider error")),
      });

      const result = await service.update("ws_123", "cust_123", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
    });
  });

  describe("delete with provider sync", () => {
    it("should continue if provider delete fails", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.customer.delete.mockResolvedValue(mockCustomer);
      billingService.getProvider.mockReturnValue({
        deleteCustomer: vi.fn().mockRejectedValue(new Error("Provider error")),
      });

      await service.delete("ws_123", "cust_123");

      expect(prisma.customer.delete).toHaveBeenCalled();
    });

    it("should skip provider sync when provider not configured", async () => {
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.customer.delete.mockResolvedValue(mockCustomer);
      billingService.isConfigured.mockReturnValue(false);

      await service.delete("ws_123", "cust_123");

      expect(providerRefService.getProviderCustomerId).not.toHaveBeenCalled();
    });
  });
});
