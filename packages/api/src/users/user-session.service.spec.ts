import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { UserSessionService } from "./user-session.service";
import { PrismaService } from "../database/prisma.service";

describe("UserSessionService", () => {
  let service: UserSessionService;
  let prisma: {
    userSession: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockSession = {
    id: "sess_123",
    userId: "user_123",
    token: "hashedtoken",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      userSession: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSessionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserSessionService>(UserSessionService);
  });

  describe("createSession", () => {
    it("should create session with generated token", async () => {
      prisma.userSession.create.mockResolvedValue(mockSession);

      const result = await service.createSession({
        userId: "user_123",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      });

      expect(result.token).toMatch(/^relay_session_/);
      expect(result.session).toEqual(mockSession);
      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user_123",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        }),
      });
    });

    it("should use default 30 day duration", async () => {
      prisma.userSession.create.mockResolvedValue(mockSession);

      await service.createSession({ userId: "user_123" });

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });

    it("should respect custom duration", async () => {
      prisma.userSession.create.mockResolvedValue(mockSession);

      await service.createSession({
        userId: "user_123",
        durationDays: 7,
      });

      expect(prisma.userSession.create).toHaveBeenCalled();
    });
  });

  describe("validateSession", () => {
    it("should return null for invalid token prefix", async () => {
      const result = await service.validateSession("invalid_token");

      expect(result).toBeNull();
      expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
    });

    it("should return null when session not found", async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);

      const result = await service.validateSession("relay_session_abc123");

      expect(result).toBeNull();
    });

    it("should return null and cleanup expired session", async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date("2020-01-01"), // Expired
      });
      prisma.userSession.delete.mockResolvedValue({});

      const result = await service.validateSession("relay_session_abc123");

      expect(result).toBeNull();
      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: "sess_123" },
      });
    });

    it("should return session context for valid session", async () => {
      prisma.userSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.validateSession("relay_session_abc123");

      expect(result).toEqual({
        userId: "user_123",
        sessionId: "sess_123",
      });
    });
  });

  describe("revokeSession", () => {
    it("should delete session", async () => {
      prisma.userSession.delete.mockResolvedValue(mockSession);

      await service.revokeSession("sess_123");

      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: "sess_123" },
      });
    });

    it("should not throw if session already deleted", async () => {
      prisma.userSession.delete.mockRejectedValue(new Error("Not found"));

      await expect(service.revokeSession("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should delete all sessions for user", async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 5 });

      await service.revokeAllUserSessions("user_123");

      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user_123" },
      });
    });
  });

  describe("listUserSessions", () => {
    it("should return non-expired sessions for user", async () => {
      const sessions = [mockSession, { ...mockSession, id: "sess_456" }];
      prisma.userSession.findMany.mockResolvedValue(sessions);

      const result = await service.listUserSessions("user_123");

      expect(result).toEqual(sessions);
      expect(prisma.userSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user_123",
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("should delete expired sessions and return count", async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 10 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(10);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
