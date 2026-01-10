import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { DunningConfigService } from "./dunning-config.service";
import { PrismaService } from "../database/prisma.service";
import { EmailTemplateService } from "../email/email-template.service";

describe("DunningConfigService", () => {
  let service: DunningConfigService;
  let prisma: {
    dunningConfig: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    dunningEmailTemplate: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
  let emailTemplateService: {
    getDefaultTemplate: ReturnType<typeof vi.fn>;
  };

  const mockWorkspaceId = "ws_123";

  const mockConfig = {
    id: "config_123",
    workspaceId: mockWorkspaceId,
    retrySchedule: [1, 3, 5, 7],
    maxAttempts: 4,
    finalAction: "suspend" as const,
    gracePeriodDays: 0,
    emailsEnabled: true,
    fromEmail: "billing@example.com",
    fromName: "Billing Team",
    replyToEmail: "support@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDefaultTemplate = {
    subject: "Payment Failed for Invoice {{invoiceNumber}}",
    html: "<p>Payment failed</p>",
    text: "Payment failed",
  };

  beforeEach(async () => {
    prisma = {
      dunningConfig: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      dunningEmailTemplate: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    emailTemplateService = {
      getDefaultTemplate: vi.fn().mockReturnValue(mockDefaultTemplate),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DunningConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailTemplateService, useValue: emailTemplateService },
      ],
    }).compile();

    service = module.get<DunningConfigService>(DunningConfigService);
  });

  describe("getConfig", () => {
    it("should return existing config with isDefault false", async () => {
      prisma.dunningConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getConfig(mockWorkspaceId);

      expect(result).toEqual({ ...mockConfig, isDefault: false });
    });

    it("should return default config when none exists", async () => {
      prisma.dunningConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig(mockWorkspaceId);

      expect(result.isDefault).toBe(true);
      expect(result.retrySchedule).toEqual([1, 3, 5, 7]);
      expect(result.maxAttempts).toBe(4);
      expect(result.finalAction).toBe("suspend");
      expect(result.emailsEnabled).toBe(false);
    });
  });

  describe("getRawConfig", () => {
    it("should return raw config", async () => {
      prisma.dunningConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getRawConfig(mockWorkspaceId);

      expect(result).toEqual(mockConfig);
    });

    it("should return null when no config exists", async () => {
      prisma.dunningConfig.findUnique.mockResolvedValue(null);

      const result = await service.getRawConfig(mockWorkspaceId);

      expect(result).toBeNull();
    });
  });

  describe("upsertConfig", () => {
    it("should create or update config", async () => {
      prisma.dunningConfig.upsert.mockResolvedValue(mockConfig);

      const result = await service.upsertConfig(mockWorkspaceId, {
        retrySchedule: [1, 2, 3],
        maxAttempts: 3,
      });

      expect(result).toEqual(mockConfig);
      expect(prisma.dunningConfig.upsert).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
        create: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          retrySchedule: [1, 2, 3],
          maxAttempts: 3,
        }),
        update: expect.objectContaining({
          retrySchedule: [1, 2, 3],
          maxAttempts: 3,
        }),
      });
    });
  });

  describe("deleteConfig", () => {
    it("should delete config", async () => {
      prisma.dunningConfig.delete.mockResolvedValue(mockConfig);

      await service.deleteConfig(mockWorkspaceId);

      expect(prisma.dunningConfig.delete).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
      });
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default configuration", () => {
      const result = service.getDefaultConfig(mockWorkspaceId);

      expect(result.id).toBe("default");
      expect(result.workspaceId).toBe(mockWorkspaceId);
      expect(result.retrySchedule).toEqual([1, 3, 5, 7]);
      expect(result.maxAttempts).toBe(4);
      expect(result.finalAction).toBe("suspend");
      expect(result.gracePeriodDays).toBe(0);
      expect(result.emailsEnabled).toBe(false);
      expect(result.isDefault).toBe(true);
    });
  });

  describe("calculateNextRetryDate", () => {
    it("should calculate next retry date based on schedule", () => {
      const config = service.getDefaultConfig(mockWorkspaceId);
      const firstFailureDate = new Date("2025-01-01T00:00:00Z");

      const result0 = service.calculateNextRetryDate(
        config,
        0,
        firstFailureDate,
      );
      const result1 = service.calculateNextRetryDate(
        config,
        1,
        firstFailureDate,
      );
      const result2 = service.calculateNextRetryDate(
        config,
        2,
        firstFailureDate,
      );
      const result3 = service.calculateNextRetryDate(
        config,
        3,
        firstFailureDate,
      );

      expect(result0?.getDate()).toBe(firstFailureDate.getDate() + 1);
      expect(result1?.getDate()).toBe(firstFailureDate.getDate() + 3);
      expect(result2?.getDate()).toBe(firstFailureDate.getDate() + 5);
      expect(result3?.getDate()).toBe(firstFailureDate.getDate() + 7);
    });

    it("should return null when no more retries scheduled", () => {
      const config = service.getDefaultConfig(mockWorkspaceId);
      const firstFailureDate = new Date("2025-01-01T00:00:00Z");

      const result = service.calculateNextRetryDate(
        config,
        4,
        firstFailureDate,
      );

      expect(result).toBeNull();
    });

    it("should handle custom retry schedules", () => {
      const config = {
        ...service.getDefaultConfig(mockWorkspaceId),
        retrySchedule: [2, 4, 6],
      };
      const firstFailureDate = new Date("2025-01-01T00:00:00Z");

      const result0 = service.calculateNextRetryDate(
        config,
        0,
        firstFailureDate,
      );
      const result1 = service.calculateNextRetryDate(
        config,
        1,
        firstFailureDate,
      );

      expect(result0?.getDate()).toBe(firstFailureDate.getDate() + 2);
      expect(result1?.getDate()).toBe(firstFailureDate.getDate() + 4);
    });
  });

  describe("isMaxAttemptsReached", () => {
    it("should return true when max attempts reached", () => {
      const config = service.getDefaultConfig(mockWorkspaceId);

      expect(service.isMaxAttemptsReached(config, 4)).toBe(true);
      expect(service.isMaxAttemptsReached(config, 5)).toBe(true);
    });

    it("should return false when attempts remaining", () => {
      const config = service.getDefaultConfig(mockWorkspaceId);

      expect(service.isMaxAttemptsReached(config, 0)).toBe(false);
      expect(service.isMaxAttemptsReached(config, 3)).toBe(false);
    });
  });

  describe("calculateFinalActionDate", () => {
    it("should add grace period days", () => {
      const config = {
        ...service.getDefaultConfig(mockWorkspaceId),
        gracePeriodDays: 3,
      };
      const lastAttemptDate = new Date("2025-01-10T00:00:00Z");

      const result = service.calculateFinalActionDate(config, lastAttemptDate);

      expect(result.getDate()).toBe(lastAttemptDate.getDate() + 3);
    });

    it("should return same date when no grace period", () => {
      const config = service.getDefaultConfig(mockWorkspaceId);
      const lastAttemptDate = new Date("2025-01-10T00:00:00Z");

      const result = service.calculateFinalActionDate(config, lastAttemptDate);

      expect(result.getDate()).toBe(lastAttemptDate.getDate());
    });
  });
});
