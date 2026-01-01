import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { PrismaService } from "../database/prisma.service";

describe("FeedbackService", () => {
  let service: FeedbackService;
  let prisma: {
    feedback: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const mockFeedback = {
    id: "fb_123",
    type: "bug" as const,
    title: "Login button broken",
    description: "Cannot click the login button on mobile",
    userId: "user_123",
    userEmail: "test@example.com",
    status: "pending" as const,
    response: null,
    respondedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      feedback: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
  });

  describe("create", () => {
    it("should create feedback with pending status", async () => {
      prisma.feedback.create.mockResolvedValue(mockFeedback);

      const result = await service.create({
        type: "bug",
        title: "Login button broken",
        description: "Cannot click the login button on mobile",
        userId: "user_123",
        userEmail: "test@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("fb_123");
      expect(result.message).toBe("Thank you for your feedback!");
      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: {
          type: "bug",
          title: "Login button broken",
          description: "Cannot click the login button on mobile",
          userId: "user_123",
          userEmail: "test@example.com",
          status: "pending",
        },
      });
    });

    it("should create feedback without userId for anonymous users", async () => {
      prisma.feedback.create.mockResolvedValue({
        ...mockFeedback,
        userId: null,
      });

      const result = await service.create({
        type: "feature",
        title: "Add dark mode",
        description: "Would love a dark mode option",
        userEmail: "anon@example.com",
      });

      expect(result.success).toBe(true);
      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: {
          type: "feature",
          title: "Add dark mode",
          description: "Would love a dark mode option",
          userId: undefined,
          userEmail: "anon@example.com",
          status: "pending",
        },
      });
    });
  });

  describe("list", () => {
    it("should return paginated feedback list", async () => {
      const feedbackList = [mockFeedback, { ...mockFeedback, id: "fb_456" }];
      prisma.feedback.findMany.mockResolvedValue(feedbackList);

      const result = await service.list({ limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      const feedbackList = Array(11)
        .fill(null)
        .map((_, i) => ({ ...mockFeedback, id: `fb_${i}` }));
      prisma.feedback.findMany.mockResolvedValue(feedbackList);

      const result = await service.list({ limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("fb_9");
    });

    it("should filter by status", async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list({ status: "reviewed" });

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "reviewed" },
        }),
      );
    });

    it("should filter by type", async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list({ type: "bug" });

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "bug" },
        }),
      );
    });

    it("should limit to maximum of 100 items", async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list({ limit: 200 });

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 101, // 100 + 1 for hasMore check
        }),
      );
    });

    it("should default to 50 items when no limit specified", async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list({});

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // 50 + 1 for hasMore check
        }),
      );
    });

    it("should use cursor for pagination", async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list({ cursor: "fb_100" });

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "fb_100" },
          skip: 1,
        }),
      );
    });
  });

  describe("findById", () => {
    it("should return feedback when found", async () => {
      prisma.feedback.findUnique.mockResolvedValue(mockFeedback);

      const result = await service.findById("fb_123");

      expect(result).toEqual(mockFeedback);
    });

    it("should throw NotFoundException when not found", async () => {
      prisma.feedback.findUnique.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should throw NotFoundException when feedback not found", async () => {
      prisma.feedback.findUnique.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", { status: "reviewed" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update status", async () => {
      prisma.feedback.findUnique.mockResolvedValue(mockFeedback);
      prisma.feedback.update.mockResolvedValue({
        ...mockFeedback,
        status: "reviewed",
      });

      const result = await service.update("fb_123", { status: "reviewed" });

      expect(result.status).toBe("reviewed");
      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: "fb_123" },
        data: { status: "reviewed" },
      });
    });

    it("should update response and set respondedAt", async () => {
      prisma.feedback.findUnique.mockResolvedValue(mockFeedback);
      prisma.feedback.update.mockResolvedValue({
        ...mockFeedback,
        response: "Thanks for reporting!",
        respondedAt: new Date(),
      });

      const result = await service.update("fb_123", {
        response: "Thanks for reporting!",
      });

      expect(result.response).toBe("Thanks for reporting!");
      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: "fb_123" },
        data: {
          response: "Thanks for reporting!",
          respondedAt: expect.any(Date),
        },
      });
    });

    it("should update both status and response", async () => {
      prisma.feedback.findUnique.mockResolvedValue(mockFeedback);
      prisma.feedback.update.mockResolvedValue({
        ...mockFeedback,
        status: "resolved",
        response: "Fixed in v2.0",
        respondedAt: new Date(),
      });

      await service.update("fb_123", {
        status: "resolved",
        response: "Fixed in v2.0",
      });

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: "fb_123" },
        data: {
          status: "resolved",
          response: "Fixed in v2.0",
          respondedAt: expect.any(Date),
        },
      });
    });
  });
});
