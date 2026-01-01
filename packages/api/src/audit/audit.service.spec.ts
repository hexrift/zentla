import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditService } from "./audit.service";
import { PrismaService } from "../database/prisma.service";

describe("AuditService", () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockAuditLog = {
    id: "log_123",
    workspaceId: "ws_123",
    actorType: "api_key" as const,
    actorId: "key_123",
    action: "customer.created",
    resourceType: "customer",
    resourceId: "cust_123",
    changes: { name: "New Name" },
    metadata: {},
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe("createAuditLog", () => {
    it("should create audit log", async () => {
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.createAuditLog({
        workspaceId: "ws_123",
        actorType: "api_key",
        actorId: "key_123",
        action: "customer.created",
        resourceType: "customer",
        resourceId: "cust_123",
        changes: { name: "New Name" },
        metadata: {},
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws_123",
          actorType: "api_key",
          actorId: "key_123",
          action: "customer.created",
          resourceType: "customer",
          resourceId: "cust_123",
        }),
      });
    });

    it("should create audit log without optional fields", async () => {
      prisma.auditLog.create.mockResolvedValue({
        ...mockAuditLog,
        changes: null,
        ipAddress: null,
        userAgent: null,
      });

      await service.createAuditLog({
        workspaceId: "ws_123",
        actorType: "user",
        actorId: "user_123",
        action: "offer.updated",
        resourceType: "offer",
        resourceId: "offer_123",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changes: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        }),
      });
    });
  });

  describe("listAuditLogs", () => {
    it("should return paginated audit logs", async () => {
      const logs = [mockAuditLog, { ...mockAuditLog, id: "log_456" }];
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.listAuditLogs("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const logs = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockAuditLog, id: `log_${i}` }));
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.listAuditLogs("ws_123", { limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("log_9");
    });

    it("should filter by actorType", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs("ws_123", {
        limit: 10,
        actorType: "user",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorType: "user" }),
        }),
      );
    });

    it("should filter by actorId", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs("ws_123", {
        limit: 10,
        actorId: "user_123",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorId: "user_123" }),
        }),
      );
    });

    it("should filter by action", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs("ws_123", {
        limit: 10,
        action: "customer.created",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: "customer.created" }),
        }),
      );
    });

    it("should filter by resourceType and resourceId", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs("ws_123", {
        limit: 10,
        resourceType: "customer",
        resourceId: "cust_123",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceType: "customer",
            resourceId: "cust_123",
          }),
        }),
      );
    });

    it("should filter by date range", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      await service.listAuditLogs("ws_123", {
        limit: 10,
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it("should use cursor for pagination", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs("ws_123", {
        limit: 10,
        cursor: "log_100",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { lt: "log_100" },
          }),
        }),
      );
    });

    it("should format log data correctly", async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.listAuditLogs("ws_123", { limit: 10 });

      expect(result.data[0]).toEqual({
        id: mockAuditLog.id,
        actorType: mockAuditLog.actorType,
        actorId: mockAuditLog.actorId,
        action: mockAuditLog.action,
        resourceType: mockAuditLog.resourceType,
        resourceId: mockAuditLog.resourceId,
        changes: mockAuditLog.changes,
        metadata: mockAuditLog.metadata,
        ipAddress: mockAuditLog.ipAddress,
        userAgent: mockAuditLog.userAgent,
        createdAt: mockAuditLog.createdAt.toISOString(),
      });
    });
  });
});
