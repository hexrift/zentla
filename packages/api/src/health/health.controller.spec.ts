import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaService } from "../database/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: {
    healthCheck: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      healthCheck: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe("check", () => {
    it("should return healthy status when database is up", async () => {
      prisma.healthCheck.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.status).toBe("healthy");
      expect(result.services.database).toBe("up");
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.memory).toBeDefined();
    });

    it("should throw HttpException when database is down", async () => {
      prisma.healthCheck.mockResolvedValue(false);

      await expect(controller.check()).rejects.toThrow(HttpException);
    });

    it("should include memory usage information", async () => {
      prisma.healthCheck.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.memory).toBeDefined();
      expect(result.memory?.heapUsed).toBeGreaterThan(0);
      expect(result.memory?.heapTotal).toBeGreaterThan(0);
      expect(result.memory?.rss).toBeGreaterThan(0);
      expect(result.memory?.percentUsed).toBeGreaterThan(0);
    });
  });

  describe("live", () => {
    it("should return ok status", () => {
      const result = controller.live();

      expect(result.status).toBe("ok");
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ready", () => {
    it("should return ready status when database is up", async () => {
      prisma.healthCheck.mockResolvedValue(true);

      const result = await controller.ready();

      expect(result.status).toBe("ready");
      expect(result.database).toBe("up");
    });

    it("should throw HttpException when database is down", async () => {
      prisma.healthCheck.mockResolvedValue(false);

      await expect(controller.ready()).rejects.toThrow(HttpException);
    });
  });
});
