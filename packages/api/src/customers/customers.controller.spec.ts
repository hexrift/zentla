import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

describe("CustomersController", () => {
  let controller: CustomersController;
  let customersService: {
    findMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createPortalSession: ReturnType<typeof vi.fn>;
  };

  const mockCustomer = {
    id: "cust_123",
    workspaceId: "ws_123",
    email: "test@example.com",
    name: "Test Customer",
    externalId: "ext_123",
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    customersService = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createPortalSession: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: customersService }],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  describe("findAll", () => {
    it("should return paginated customers", async () => {
      customersService.findMany.mockResolvedValue({
        data: [mockCustomer],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.findAll("ws_123", {});

      expect(result.data).toHaveLength(1);
      expect(customersService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 20,
        cursor: undefined,
        email: undefined,
        externalId: undefined,
      });
    });

    it("should pass filters to service", async () => {
      customersService.findMany.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.findAll("ws_123", {
        limit: 50,
        cursor: "cursor123",
        email: "test@example.com",
        externalId: "ext_123",
      });

      expect(customersService.findMany).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: "cursor123",
        email: "test@example.com",
        externalId: "ext_123",
      });
    });
  });

  describe("findOne", () => {
    it("should return customer when found", async () => {
      customersService.findById.mockResolvedValue(mockCustomer);

      const result = await controller.findOne("ws_123", "cust_123");

      expect(result).toEqual(mockCustomer);
    });

    it("should throw NotFoundException when not found", async () => {
      customersService.findById.mockResolvedValue(null);

      await expect(controller.findOne("ws_123", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    it("should create customer", async () => {
      customersService.create.mockResolvedValue(mockCustomer);

      const result = await controller.create("ws_123", {
        email: "test@example.com",
        name: "Test Customer",
      });

      expect(result).toEqual(mockCustomer);
      expect(customersService.create).toHaveBeenCalledWith("ws_123", {
        email: "test@example.com",
        name: "Test Customer",
      });
    });

    it("should pass all optional fields", async () => {
      customersService.create.mockResolvedValue(mockCustomer);

      await controller.create("ws_123", {
        email: "test@example.com",
        name: "Test Customer",
        externalId: "ext_123",
        metadata: { source: "api" },
      });

      expect(customersService.create).toHaveBeenCalledWith("ws_123", {
        email: "test@example.com",
        name: "Test Customer",
        externalId: "ext_123",
        metadata: { source: "api" },
      });
    });
  });

  describe("update", () => {
    it("should update customer", async () => {
      customersService.update.mockResolvedValue({
        ...mockCustomer,
        name: "Updated Name",
        version: 2,
      });

      const result = await controller.update(
        "ws_123",
        "cust_123",
        undefined,
        { name: "Updated Name" },
      );

      expect(result.name).toBe("Updated Name");
      expect(customersService.update).toHaveBeenCalledWith(
        "ws_123",
        "cust_123",
        { name: "Updated Name" },
        undefined,
      );
    });

    it("should pass version from If-Match header", async () => {
      customersService.update.mockResolvedValue({
        ...mockCustomer,
        version: 2,
      });

      await controller.update(
        "ws_123",
        "cust_123",
        'W/"cust_123-1"',
        { name: "Updated Name" },
      );

      expect(customersService.update).toHaveBeenCalledWith(
        "ws_123",
        "cust_123",
        { name: "Updated Name" },
        1,
      );
    });
  });

  describe("delete", () => {
    it("should delete customer", async () => {
      customersService.delete.mockResolvedValue(undefined);

      await controller.delete("ws_123", "cust_123");

      expect(customersService.delete).toHaveBeenCalledWith("ws_123", "cust_123");
    });
  });

  describe("createPortalSession", () => {
    it("should create portal session", async () => {
      const mockPortalSession = {
        id: "bps_123",
        url: "https://billing.stripe.com/session/123",
        returnUrl: "https://app.example.com/billing",
        createdAt: new Date(),
      };
      customersService.createPortalSession.mockResolvedValue(mockPortalSession);

      const result = await controller.createPortalSession("ws_123", "cust_123", {
        returnUrl: "https://app.example.com/billing",
      });

      expect(result).toEqual(mockPortalSession);
      expect(customersService.createPortalSession).toHaveBeenCalledWith(
        "ws_123",
        "cust_123",
        "https://app.example.com/billing",
      );
    });
  });
});
