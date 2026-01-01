import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";

describe("FeedbackController", () => {
  let controller: FeedbackController;
  let feedbackService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const mockFeedback = {
    id: "fb_123",
    type: "bug" as const,
    title: "Login not working",
    description: "Cannot log in with valid credentials",
    status: "pending" as const,
    userId: "user_123",
    userEmail: "user@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    feedbackService = {
      create: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [{ provide: FeedbackService, useValue: feedbackService }],
    }).compile();

    controller = module.get<FeedbackController>(FeedbackController);
  });

  describe("create", () => {
    it("should create feedback from authenticated user", async () => {
      feedbackService.create.mockResolvedValue(mockFeedback);

      const result = await controller.create(
        {
          type: "bug",
          title: "Login not working",
          description: "Cannot log in with valid credentials",
        },
        { id: "user_123", email: "user@example.com" },
      );

      expect(result).toEqual(mockFeedback);
      expect(feedbackService.create).toHaveBeenCalledWith({
        type: "bug",
        title: "Login not working",
        description: "Cannot log in with valid credentials",
        userId: "user_123",
        userEmail: "user@example.com",
      });
    });

    it("should create feedback from anonymous user with email", async () => {
      feedbackService.create.mockResolvedValue({
        ...mockFeedback,
        userId: undefined,
      });

      const result = await controller.create(
        {
          type: "feature",
          title: "Add dark mode",
          description: "Please add a dark mode theme option",
          email: "anonymous@example.com",
        },
        null,
      );

      expect(result).toBeDefined();
      expect(feedbackService.create).toHaveBeenCalledWith({
        type: "feature",
        title: "Add dark mode",
        description: "Please add a dark mode theme option",
        userId: undefined,
        userEmail: "anonymous@example.com",
      });
    });

    it("should create feedback from anonymous user without email", async () => {
      feedbackService.create.mockResolvedValue({
        ...mockFeedback,
        userId: undefined,
        userEmail: undefined,
      });

      await controller.create(
        {
          type: "other",
          title: "General feedback",
          description: "Just wanted to say great product!",
        },
        null,
      );

      expect(feedbackService.create).toHaveBeenCalledWith({
        type: "other",
        title: "General feedback",
        description: "Just wanted to say great product!",
        userId: undefined,
        userEmail: undefined,
      });
    });
  });

  describe("list", () => {
    it("should return paginated feedback list", async () => {
      feedbackService.list.mockResolvedValue({
        data: [mockFeedback],
        hasMore: false,
        nextCursor: null,
      });

      const result = await controller.list();

      expect(result.data).toHaveLength(1);
      expect(feedbackService.list).toHaveBeenCalledWith({
        status: undefined,
        type: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });

    it("should pass filters to service", async () => {
      feedbackService.list.mockResolvedValue({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      await controller.list("pending", "bug", "25", "cursor123");

      expect(feedbackService.list).toHaveBeenCalledWith({
        status: "pending",
        type: "bug",
        limit: 25,
        cursor: "cursor123",
      });
    });
  });

  describe("get", () => {
    it("should return feedback by ID", async () => {
      feedbackService.findById.mockResolvedValue(mockFeedback);

      const result = await controller.get("fb_123");

      expect(result).toEqual(mockFeedback);
      expect(feedbackService.findById).toHaveBeenCalledWith("fb_123");
    });
  });

  describe("update", () => {
    it("should update feedback status", async () => {
      feedbackService.update.mockResolvedValue({
        ...mockFeedback,
        status: "reviewed",
      });

      const result = await controller.update("fb_123", { status: "reviewed" });

      expect(result.status).toBe("reviewed");
      expect(feedbackService.update).toHaveBeenCalledWith("fb_123", {
        status: "reviewed",
      });
    });

    it("should update feedback with response", async () => {
      feedbackService.update.mockResolvedValue({
        ...mockFeedback,
        status: "resolved",
        response: "Fixed in v2.0",
      });

      const result = await controller.update("fb_123", {
        status: "resolved",
        response: "Fixed in v2.0",
      });

      expect(result.status).toBe("resolved");
      expect(result.response).toBe("Fixed in v2.0");
    });
  });
});
