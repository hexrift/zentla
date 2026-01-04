import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SeatsService } from "./seats.service";
import { EntitlementsService, EntitlementCheck } from "./entitlements.service";
import { PrismaService } from "../database/prisma.service";

describe("SeatsService", () => {
  let service: SeatsService;
  let prisma: {
    seatAssignment: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let entitlementsService: {
    checkEntitlement: ReturnType<typeof vi.fn>;
    getCustomerEntitlements: ReturnType<typeof vi.fn>;
  };

  const mockSeatAssignment = {
    id: "seat_123",
    workspaceId: "ws_123",
    customerId: "cust_123",
    featureKey: "seats",
    userId: "user_123",
    userEmail: "user@example.com",
    userName: "Test User",
    assignedAt: new Date(),
    expiresAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEntitlement: EntitlementCheck = {
    hasAccess: true,
    featureKey: "seats",
    value: 10,
    valueType: "number",
  };

  beforeEach(async () => {
    prisma = {
      seatAssignment: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    entitlementsService = {
      checkEntitlement: vi.fn(),
      getCustomerEntitlements: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    service = module.get<SeatsService>(SeatsService);
  });

  describe("assignSeat", () => {
    it("should assign a new seat", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);
      entitlementsService.checkEntitlement.mockResolvedValue(mockEntitlement);
      prisma.seatAssignment.count.mockResolvedValue(5);
      prisma.seatAssignment.create.mockResolvedValue(mockSeatAssignment);

      const result = await service.assignSeat(
        "ws_123",
        "cust_123",
        "seats",
        "user_123",
        { userEmail: "user@example.com" },
      );

      expect(result.userId).toBe("user_123");
      expect(result.featureKey).toBe("seats");
    });

    it("should return existing seat if already assigned", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(mockSeatAssignment);

      const result = await service.assignSeat(
        "ws_123",
        "cust_123",
        "seats",
        "user_123",
      );

      expect(result.id).toBe("seat_123");
      expect(prisma.seatAssignment.create).not.toHaveBeenCalled();
    });

    it("should throw when no entitlement", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);
      entitlementsService.checkEntitlement.mockResolvedValue({
        hasAccess: false,
        featureKey: "seats",
      });

      await expect(
        service.assignSeat("ws_123", "cust_123", "seats", "user_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw when no seats available", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);
      entitlementsService.checkEntitlement.mockResolvedValue(mockEntitlement);
      prisma.seatAssignment.count.mockResolvedValue(10); // All seats used

      await expect(
        service.assignSeat("ws_123", "cust_123", "seats", "user_123"),
      ).rejects.toThrow("No available seats");
    });

    it("should allow assignment when unlimited seats", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);
      entitlementsService.checkEntitlement.mockResolvedValue({
        ...mockEntitlement,
        valueType: "unlimited",
        value: Infinity,
      });
      prisma.seatAssignment.count.mockResolvedValue(1000);
      prisma.seatAssignment.create.mockResolvedValue(mockSeatAssignment);

      const result = await service.assignSeat(
        "ws_123",
        "cust_123",
        "seats",
        "user_123",
      );

      expect(result.userId).toBe("user_123");
    });
  });

  describe("unassignSeat", () => {
    it("should unassign a seat", async () => {
      prisma.seatAssignment.deleteMany.mockResolvedValue({ count: 1 });

      await service.unassignSeat("ws_123", "cust_123", "seats", "user_123");

      expect(prisma.seatAssignment.deleteMany).toHaveBeenCalled();
    });

    it("should throw when seat not found", async () => {
      prisma.seatAssignment.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.unassignSeat("ws_123", "cust_123", "seats", "user_123"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("hasSeat", () => {
    it("should return true when seat exists", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(mockSeatAssignment);

      const result = await service.hasSeat(
        "ws_123",
        "cust_123",
        "seats",
        "user_123",
      );

      expect(result).toBe(true);
    });

    it("should return false when no seat", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);

      const result = await service.hasSeat(
        "ws_123",
        "cust_123",
        "seats",
        "user_999",
      );

      expect(result).toBe(false);
    });
  });

  describe("getAssignments", () => {
    it("should return all assignments for feature", async () => {
      prisma.seatAssignment.findMany.mockResolvedValue([
        mockSeatAssignment,
        { ...mockSeatAssignment, id: "seat_456", userId: "user_456" },
      ]);

      const result = await service.getAssignments(
        "ws_123",
        "cust_123",
        "seats",
      );

      expect(result).toHaveLength(2);
    });
  });

  describe("getSeatUsage", () => {
    it("should return usage summary with available seats", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue(mockEntitlement);
      prisma.seatAssignment.findMany.mockResolvedValue([mockSeatAssignment]);

      const result = await service.getSeatUsage("ws_123", "cust_123", "seats");

      expect(result.totalSeats).toBe(10);
      expect(result.usedSeats).toBe(1);
      expect(result.availableSeats).toBe(9);
      expect(result.isUnlimited).toBe(false);
    });

    it("should handle unlimited seats", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue({
        ...mockEntitlement,
        valueType: "unlimited",
        value: Infinity,
      });
      prisma.seatAssignment.findMany.mockResolvedValue([mockSeatAssignment]);

      const result = await service.getSeatUsage("ws_123", "cust_123", "seats");

      expect(result.totalSeats).toBeNull();
      expect(result.usedSeats).toBe(1);
      expect(result.availableSeats).toBeNull();
      expect(result.isUnlimited).toBe(true);
    });

    it("should return zero seats when no entitlement", async () => {
      entitlementsService.checkEntitlement.mockResolvedValue({
        hasAccess: false,
        featureKey: "seats",
      });
      prisma.seatAssignment.findMany.mockResolvedValue([]);

      const result = await service.getSeatUsage("ws_123", "cust_123", "seats");

      expect(result.totalSeats).toBe(0);
      expect(result.availableSeats).toBe(0);
    });
  });

  describe("getAllSeatUsage", () => {
    it("should return usage for all numeric entitlements", async () => {
      entitlementsService.getCustomerEntitlements.mockResolvedValue({
        customerId: "cust_123",
        entitlements: [
          { featureKey: "seats", valueType: "number", value: 10 },
          { featureKey: "api_access", valueType: "boolean", value: true },
          { featureKey: "storage", valueType: "unlimited", value: Infinity },
        ],
        activeSubscriptionIds: ["sub_123"],
      });
      entitlementsService.checkEntitlement.mockResolvedValue(mockEntitlement);
      prisma.seatAssignment.findMany.mockResolvedValue([]);

      const result = await service.getAllSeatUsage("ws_123", "cust_123");

      // Should only include numeric and unlimited, not boolean
      expect(result).toHaveLength(2);
    });
  });

  describe("bulkAssignSeats", () => {
    it("should assign multiple seats and report errors", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);
      entitlementsService.checkEntitlement.mockResolvedValue(mockEntitlement);
      prisma.seatAssignment.count.mockResolvedValue(0);
      prisma.seatAssignment.create
        .mockResolvedValueOnce(mockSeatAssignment)
        .mockRejectedValueOnce(new Error("Duplicate"));

      const result = await service.bulkAssignSeats(
        "ws_123",
        "cust_123",
        "seats",
        [
          { userId: "user_1", userEmail: "user1@example.com" },
          { userId: "user_2", userEmail: "user2@example.com" },
        ],
      );

      expect(result.assigned).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe("user_2");
    });
  });

  describe("bulkUnassignSeats", () => {
    it("should unassign multiple seats", async () => {
      prisma.seatAssignment.deleteMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await service.bulkUnassignSeats(
        "ws_123",
        "cust_123",
        "seats",
        ["user_1", "user_2"],
      );

      expect(result.unassigned).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("transferSeat", () => {
    it("should transfer seat from one user to another", async () => {
      prisma.seatAssignment.findFirst
        .mockResolvedValueOnce(mockSeatAssignment) // Original assignment
        .mockResolvedValueOnce(null) // Check target doesn't have seat
        .mockResolvedValueOnce({ ...mockSeatAssignment, userId: "user_456" }); // New assignment

      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      prisma.seatAssignment.delete.mockResolvedValue({});
      prisma.seatAssignment.create.mockResolvedValue({
        ...mockSeatAssignment,
        userId: "user_456",
      });

      const result = await service.transferSeat(
        "ws_123",
        "cust_123",
        "seats",
        "user_123",
        "user_456",
      );

      expect(result.userId).toBe("user_456");
    });

    it("should throw when source seat not found", async () => {
      prisma.seatAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.transferSeat(
          "ws_123",
          "cust_123",
          "seats",
          "user_123",
          "user_456",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw when target already has seat", async () => {
      prisma.seatAssignment.findFirst
        .mockResolvedValueOnce(mockSeatAssignment)
        .mockResolvedValueOnce({ ...mockSeatAssignment, userId: "user_456" });

      await expect(
        service.transferSeat(
          "ws_123",
          "cust_123",
          "seats",
          "user_123",
          "user_456",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("revokeAllSeats", () => {
    it("should revoke all seats for a customer", async () => {
      prisma.seatAssignment.deleteMany.mockResolvedValue({ count: 5 });

      const count = await service.revokeAllSeats("ws_123", "cust_123");

      expect(count).toBe(5);
    });

    it("should revoke seats for specific feature", async () => {
      prisma.seatAssignment.deleteMany.mockResolvedValue({ count: 3 });

      const count = await service.revokeAllSeats(
        "ws_123",
        "cust_123",
        "seats",
      );

      expect(count).toBe(3);
      expect(prisma.seatAssignment.deleteMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          customerId: "cust_123",
          featureKey: "seats",
        },
      });
    });
  });
});
