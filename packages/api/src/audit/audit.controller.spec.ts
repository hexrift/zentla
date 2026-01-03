import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

describe("AuditController", () => {
  let controller: AuditController;
  let auditService: {
    listAuditLogs: ReturnType<typeof vi.fn>;
  };

  const mockAuditLog = {
    id: "log_123",
    actorType: "api_key" as const,
    actorId: "key_123",
    action: "customer.created",
    resourceType: "customer",
    resourceId: "cust_123",
    changes: { name: "New Name" },
    metadata: {},
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(async () => {
    auditService = {
      listAuditLogs: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: auditService }],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  describe("listAuditLogs", () => {
    it("should return audit logs with pagination", async () => {
      auditService.listAuditLogs.mockResolvedValue({
        data: [mockAuditLog],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.listAuditLogs("ws_123", {});

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(auditService.listAuditLogs).toHaveBeenCalledWith("ws_123", {
        limit: 50,
        cursor: undefined,
        actorType: undefined,
        actorId: undefined,
        action: undefined,
        resourceType: undefined,
        resourceId: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it("should pass filters to service", async () => {
      auditService.listAuditLogs.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listAuditLogs("ws_123", {
        limit: 25,
        cursor: "cursor123",
        actorType: "user" as const,
        actorId: "user_123",
        action: "customer.created",
        resourceType: "customer",
        resourceId: "cust_123",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(auditService.listAuditLogs).toHaveBeenCalledWith("ws_123", {
        limit: 25,
        cursor: "cursor123",
        actorType: "user",
        actorId: "user_123",
        action: "customer.created",
        resourceType: "customer",
        resourceId: "cust_123",
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it("should handle hasMore pagination", async () => {
      auditService.listAuditLogs.mockResolvedValue({
        data: [mockAuditLog],
        hasMore: true,
        nextCursor: "log_100",
      });

      const result = await controller.listAuditLogs("ws_123", { limit: 10 });

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("log_100");
    });

    it("should use default limit when not provided", async () => {
      auditService.listAuditLogs.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.listAuditLogs("ws_123", {});

      expect(auditService.listAuditLogs).toHaveBeenCalledWith(
        "ws_123",
        expect.objectContaining({ limit: 50 }),
      );
    });
  });
});
