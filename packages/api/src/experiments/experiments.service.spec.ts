import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ExperimentsService } from "./experiments.service";
import { PrismaService } from "../database/prisma.service";

describe("ExperimentsService", () => {
  let service: ExperimentsService;
  let prisma: {
    experiment: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    experimentVariant: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    experimentAssignment: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockVariantControl = {
    id: "var_control",
    experimentId: "exp_123",
    key: "control",
    name: "Control",
    description: null,
    weight: 1,
    config: {},
    isControl: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVariantTreatment = {
    id: "var_treatment",
    experimentId: "exp_123",
    key: "treatment",
    name: "Treatment",
    description: null,
    weight: 1,
    config: { enabled: true },
    isControl: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExperiment = {
    id: "exp_123",
    workspaceId: "ws_123",
    key: "test-experiment",
    name: "Test Experiment",
    description: "A test experiment",
    type: "feature" as const,
    status: "draft" as const,
    trafficAllocation: 100,
    targetingRules: {},
    startAt: null,
    endAt: null,
    winningVariantId: null,
    concludedAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    variants: [mockVariantControl, mockVariantTreatment],
  };

  const mockRunningExperiment = {
    ...mockExperiment,
    status: "running" as const,
    startAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      experiment: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      experimentVariant: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      experimentAssignment: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
  });

  describe("createExperiment", () => {
    it("should create a new experiment", async () => {
      prisma.experiment.findUnique.mockResolvedValue(null);
      prisma.experiment.create.mockResolvedValue(mockExperiment);

      const result = await service.createExperiment("ws_123", {
        key: "test-experiment",
        name: "Test Experiment",
        description: "A test experiment",
      });

      expect(result.key).toBe("test-experiment");
      expect(result.name).toBe("Test Experiment");
      expect(prisma.experiment.create).toHaveBeenCalled();
    });

    it("should throw ConflictException if key already exists", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockExperiment);

      await expect(
        service.createExperiment("ws_123", {
          key: "test-experiment",
          name: "Test Experiment",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("getExperiment", () => {
    it("should return experiment by ID", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);

      const result = await service.getExperiment("ws_123", "exp_123");

      expect(result).toEqual(mockExperiment);
    });

    it("should return null if not found", async () => {
      prisma.experiment.findFirst.mockResolvedValue(null);

      const result = await service.getExperiment("ws_123", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getExperimentByKey", () => {
    it("should return experiment by key", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockExperiment);

      const result = await service.getExperimentByKey(
        "ws_123",
        "test-experiment",
      );

      expect(result).toEqual(mockExperiment);
    });
  });

  describe("listExperiments", () => {
    it("should list all experiments", async () => {
      prisma.experiment.findMany.mockResolvedValue([mockExperiment]);

      const result = await service.listExperiments("ws_123");

      expect(result).toHaveLength(1);
    });

    it("should filter by status", async () => {
      prisma.experiment.findMany.mockResolvedValue([mockRunningExperiment]);

      const result = await service.listExperiments("ws_123", {
        status: "running",
      });

      expect(result).toHaveLength(1);
      expect(prisma.experiment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "running" }),
        }),
      );
    });
  });

  describe("startExperiment", () => {
    it("should start a draft experiment", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);
      prisma.experiment.update.mockResolvedValue({
        ...mockExperiment,
        status: "running",
      });

      const result = await service.startExperiment("ws_123", "exp_123");

      expect(result.status).toBe("running");
    });

    it("should throw if experiment not found", async () => {
      prisma.experiment.findFirst.mockResolvedValue(null);

      await expect(
        service.startExperiment("ws_123", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if experiment is already running", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockRunningExperiment);

      await expect(
        service.startExperiment("ws_123", "exp_123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if experiment has fewer than 2 variants", async () => {
      prisma.experiment.findFirst.mockResolvedValue({
        ...mockExperiment,
        variants: [mockVariantControl],
      });

      await expect(
        service.startExperiment("ws_123", "exp_123"),
      ).rejects.toThrow("at least 2 variants");
    });
  });

  describe("pauseExperiment", () => {
    it("should pause a running experiment", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockRunningExperiment);
      prisma.experiment.update.mockResolvedValue({
        ...mockRunningExperiment,
        status: "paused",
      });

      const result = await service.pauseExperiment("ws_123", "exp_123");

      expect(result.status).toBe("paused");
    });

    it("should throw if experiment is not running", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);

      await expect(
        service.pauseExperiment("ws_123", "exp_123"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("concludeExperiment", () => {
    it("should conclude experiment with winning variant", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockRunningExperiment);
      prisma.experiment.update.mockResolvedValue({
        ...mockRunningExperiment,
        status: "concluded",
        winningVariantId: "var_treatment",
      });

      const result = await service.concludeExperiment(
        "ws_123",
        "exp_123",
        "var_treatment",
      );

      expect(result.status).toBe("concluded");
      expect(result.winningVariantId).toBe("var_treatment");
    });

    it("should throw if winning variant not found", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockRunningExperiment);

      await expect(
        service.concludeExperiment("ws_123", "exp_123", "nonexistent"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("addVariant", () => {
    it("should add a variant to draft experiment", async () => {
      prisma.experiment.findFirst.mockResolvedValue({
        ...mockExperiment,
        variants: [],
      });
      prisma.experimentVariant.create.mockResolvedValue(mockVariantControl);

      const result = await service.addVariant("ws_123", "exp_123", {
        key: "control",
        name: "Control",
        isControl: true,
      });

      expect(result.key).toBe("control");
    });

    it("should throw if experiment is not draft", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockRunningExperiment);

      await expect(
        service.addVariant("ws_123", "exp_123", {
          key: "new-variant",
          name: "New Variant",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if variant key already exists", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);

      await expect(
        service.addVariant("ws_123", "exp_123", {
          key: "control",
          name: "Another Control",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("updateVariant", () => {
    it("should update variant properties", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);
      prisma.experimentVariant.update.mockResolvedValue({
        ...mockVariantControl,
        name: "Updated Control",
      });

      const result = await service.updateVariant(
        "ws_123",
        "exp_123",
        "var_control",
        { name: "Updated Control" },
      );

      expect(result.name).toBe("Updated Control");
    });
  });

  describe("deleteVariant", () => {
    it("should delete variant from draft experiment", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);
      prisma.experimentVariant.delete.mockResolvedValue({});

      await service.deleteVariant("ws_123", "exp_123", "var_control");

      expect(prisma.experimentVariant.delete).toHaveBeenCalledWith({
        where: { id: "var_control" },
      });
    });

    it("should throw if experiment is not draft", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockRunningExperiment);

      await expect(
        service.deleteVariant("ws_123", "exp_123", "var_control"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getAssignment", () => {
    it("should create new assignment for running experiment", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockRunningExperiment);
      prisma.experimentAssignment.findFirst.mockResolvedValue(null);
      prisma.experimentAssignment.create.mockResolvedValue({
        id: "assign_123",
        experimentId: "exp_123",
        variantId: "var_control",
        customerId: "cust_123",
        exposureCount: 1,
      });

      const result = await service.getAssignment("ws_123", "test-experiment", {
        customerId: "cust_123",
      });

      expect(result).not.toBeNull();
      expect(result?.isNewAssignment).toBe(true);
    });

    it("should return existing assignment", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockRunningExperiment);
      prisma.experimentAssignment.findFirst.mockResolvedValue({
        id: "assign_123",
        experimentId: "exp_123",
        variantId: "var_control",
        customerId: "cust_123",
        exposureCount: 5,
      });
      prisma.experimentAssignment.update.mockResolvedValue({});

      const result = await service.getAssignment("ws_123", "test-experiment", {
        customerId: "cust_123",
      });

      expect(result?.isNewAssignment).toBe(false);
    });

    it("should return null for non-running experiment", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockExperiment);

      const result = await service.getAssignment("ws_123", "test-experiment", {
        customerId: "cust_123",
      });

      expect(result).toBeNull();
    });

    it("should return winning variant for concluded experiment", async () => {
      const concludedExperiment = {
        ...mockExperiment,
        status: "concluded" as const,
        winningVariantId: "var_treatment",
      };
      prisma.experiment.findUnique.mockResolvedValue(concludedExperiment);

      const result = await service.getAssignment("ws_123", "test-experiment", {
        customerId: "cust_123",
      });

      expect(result?.variantKey).toBe("treatment");
      expect(result?.isNewAssignment).toBe(false);
    });

    it("should throw if no subject ID provided", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockRunningExperiment);

      await expect(
        service.getAssignment("ws_123", "test-experiment", {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("should respect traffic allocation", async () => {
      const lowTrafficExperiment = {
        ...mockRunningExperiment,
        trafficAllocation: 0,
      };
      prisma.experiment.findUnique.mockResolvedValue(lowTrafficExperiment);

      const result = await service.getAssignment("ws_123", "test-experiment", {
        customerId: "cust_123",
      });

      expect(result).toBeNull();
    });
  });

  describe("overrideAssignment", () => {
    it("should create override assignment", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);
      prisma.experimentAssignment.deleteMany.mockResolvedValue({ count: 0 });
      prisma.experimentAssignment.create.mockResolvedValue({
        id: "assign_override",
        experimentId: "exp_123",
        variantId: "var_treatment",
        customerId: "cust_123",
        source: "override",
      });

      const result = await service.overrideAssignment(
        "ws_123",
        "exp_123",
        "var_treatment",
        { customerId: "cust_123" },
      );

      expect(result.variantKey).toBe("treatment");
      expect(result.isNewAssignment).toBe(true);
    });
  });

  describe("recordConversion", () => {
    it("should record conversion for assignment", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockExperiment);
      prisma.experimentAssignment.findFirst.mockResolvedValue({
        id: "assign_123",
        convertedAt: null,
      });
      prisma.experimentAssignment.update.mockResolvedValue({});

      const result = await service.recordConversion(
        "ws_123",
        "test-experiment",
        { customerId: "cust_123", value: 99.99 },
      );

      expect(result).toBe(true);
    });

    it("should not record duplicate conversion", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockExperiment);
      prisma.experimentAssignment.findFirst.mockResolvedValue({
        id: "assign_123",
        convertedAt: new Date(),
      });

      const result = await service.recordConversion(
        "ws_123",
        "test-experiment",
        { customerId: "cust_123" },
      );

      expect(result).toBe(false);
    });
  });

  describe("getExperimentStats", () => {
    it("should return experiment statistics", async () => {
      prisma.experiment.findFirst.mockResolvedValue(mockExperiment);
      prisma.experimentAssignment.findMany.mockResolvedValue([
        {
          id: "a1",
          variantId: "var_control",
          exposureCount: 1,
          convertedAt: new Date(),
          conversionValue: { toNumber: () => 50 },
        },
        {
          id: "a2",
          variantId: "var_control",
          exposureCount: 1,
          convertedAt: null,
          conversionValue: null,
        },
        {
          id: "a3",
          variantId: "var_treatment",
          exposureCount: 1,
          convertedAt: new Date(),
          conversionValue: { toNumber: () => 100 },
        },
      ]);

      const result = await service.getExperimentStats("ws_123", "exp_123");

      expect(result.totalAssignments).toBe(3);
      expect(result.totalConversions).toBe(2);
      expect(result.variantStats).toHaveLength(2);
    });
  });

  describe("deterministic bucketing", () => {
    it("should consistently assign same customer to same variant", async () => {
      prisma.experiment.findUnique.mockResolvedValue(mockRunningExperiment);
      prisma.experimentAssignment.findFirst.mockResolvedValue(null);

      // Track which variant was assigned
      let assignedVariantId: string | null = null;
      prisma.experimentAssignment.create.mockImplementation(async (data) => {
        assignedVariantId = data.data.variantId;
        return {
          id: "assign_new",
          ...data.data,
          exposureCount: 1,
        };
      });

      // First assignment
      await service.getAssignment("ws_123", "test-experiment", {
        customerId: "consistent-customer",
      });

      const firstVariant = assignedVariantId;

      // Reset mock for second call
      prisma.experimentAssignment.findFirst.mockResolvedValue(null);

      // Second assignment with same customer should get same variant
      await service.getAssignment("ws_123", "test-experiment", {
        customerId: "consistent-customer",
      });

      expect(assignedVariantId).toBe(firstVariant);
    });
  });
});
