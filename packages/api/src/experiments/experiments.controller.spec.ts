import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";

describe("ExperimentsController", () => {
  let controller: ExperimentsController;
  let experimentsService: {
    createExperiment: ReturnType<typeof vi.fn>;
    getExperiment: ReturnType<typeof vi.fn>;
    getExperimentByKey: ReturnType<typeof vi.fn>;
    listExperiments: ReturnType<typeof vi.fn>;
    updateExperiment: ReturnType<typeof vi.fn>;
    startExperiment: ReturnType<typeof vi.fn>;
    pauseExperiment: ReturnType<typeof vi.fn>;
    concludeExperiment: ReturnType<typeof vi.fn>;
    archiveExperiment: ReturnType<typeof vi.fn>;
    addVariant: ReturnType<typeof vi.fn>;
    updateVariant: ReturnType<typeof vi.fn>;
    deleteVariant: ReturnType<typeof vi.fn>;
    getAssignment: ReturnType<typeof vi.fn>;
    getActiveAssignments: ReturnType<typeof vi.fn>;
    overrideAssignment: ReturnType<typeof vi.fn>;
    recordConversion: ReturnType<typeof vi.fn>;
    getExperimentStats: ReturnType<typeof vi.fn>;
  };

  const mockVariant = {
    id: "var_123",
    experimentId: "exp_123",
    key: "control",
    name: "Control Group",
    description: "Original experience",
    weight: 1,
    config: { buttonColor: "blue" },
    isControl: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExperiment = {
    id: "exp_123",
    workspaceId: "ws_123",
    key: "pricing-page-v2",
    name: "Pricing Page V2 Test",
    description: "Testing new pricing page design",
    type: "feature",
    status: "draft",
    trafficAllocation: 100,
    targetingRules: {},
    startAt: null,
    endAt: null,
    winningVariantId: null,
    concludedAt: null,
    metadata: {},
    variants: [mockVariant],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAssignment = {
    experimentKey: "pricing-page-v2",
    variantKey: "control",
    variantConfig: { buttonColor: "blue" },
    isControl: true,
    assignmentId: "assign_123",
    isNewAssignment: true,
  };

  const mockStats = {
    experimentId: "exp_123",
    totalAssignments: 1000,
    totalExposures: 950,
    totalConversions: 100,
    conversionRate: 0.105,
    variantStats: [
      {
        variantId: "var_123",
        variantKey: "control",
        isControl: true,
        assignments: 500,
        exposures: 475,
        conversions: 45,
        conversionRate: 0.095,
        totalConversionValue: 4500,
      },
      {
        variantId: "var_456",
        variantKey: "treatment",
        isControl: false,
        assignments: 500,
        exposures: 475,
        conversions: 55,
        conversionRate: 0.116,
        totalConversionValue: 5500,
      },
    ],
  };

  beforeEach(async () => {
    experimentsService = {
      createExperiment: vi.fn(),
      getExperiment: vi.fn(),
      getExperimentByKey: vi.fn(),
      listExperiments: vi.fn(),
      updateExperiment: vi.fn(),
      startExperiment: vi.fn(),
      pauseExperiment: vi.fn(),
      concludeExperiment: vi.fn(),
      archiveExperiment: vi.fn(),
      addVariant: vi.fn(),
      updateVariant: vi.fn(),
      deleteVariant: vi.fn(),
      getAssignment: vi.fn(),
      getActiveAssignments: vi.fn(),
      overrideAssignment: vi.fn(),
      recordConversion: vi.fn(),
      getExperimentStats: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [
        { provide: ExperimentsService, useValue: experimentsService },
      ],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
  });

  // =========================================================================
  // EXPERIMENT MANAGEMENT
  // =========================================================================

  describe("createExperiment", () => {
    it("should create a new experiment", async () => {
      experimentsService.createExperiment.mockResolvedValue(mockExperiment);

      const result = await controller.createExperiment("ws_123", {
        key: "pricing-page-v2",
        name: "Pricing Page V2 Test",
        description: "Testing new pricing page design",
      });

      expect(experimentsService.createExperiment).toHaveBeenCalledWith(
        "ws_123",
        expect.objectContaining({
          key: "pricing-page-v2",
          name: "Pricing Page V2 Test",
          description: "Testing new pricing page design",
        }),
      );
      expect(result.id).toBe("exp_123");
      expect(result.status).toBe("draft");
    });

    it("should create experiment with all options", async () => {
      experimentsService.createExperiment.mockResolvedValue(mockExperiment);

      await controller.createExperiment("ws_123", {
        key: "pricing-page-v2",
        name: "Pricing Page V2 Test",
        type: "pricing",
        trafficAllocation: 50,
        targetingRules: { plan: "pro" },
        startAt: "2024-01-01",
        endAt: "2024-02-01",
        metadata: { owner: "product" },
      });

      expect(experimentsService.createExperiment).toHaveBeenCalledWith(
        "ws_123",
        expect.objectContaining({
          type: "pricing",
          trafficAllocation: 50,
          targetingRules: { plan: "pro" },
          startAt: expect.any(Date),
          endAt: expect.any(Date),
          metadata: { owner: "product" },
        }),
      );
    });
  });

  describe("listExperiments", () => {
    it("should list all experiments", async () => {
      experimentsService.listExperiments.mockResolvedValue([mockExperiment]);

      const result = await controller.listExperiments("ws_123", {});

      expect(experimentsService.listExperiments).toHaveBeenCalledWith(
        "ws_123",
        { status: undefined, type: undefined },
      );
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("pricing-page-v2");
    });

    it("should filter by status", async () => {
      experimentsService.listExperiments.mockResolvedValue([]);

      await controller.listExperiments("ws_123", { status: "running" });

      expect(experimentsService.listExperiments).toHaveBeenCalledWith(
        "ws_123",
        { status: "running", type: undefined },
      );
    });

    it("should filter by type", async () => {
      experimentsService.listExperiments.mockResolvedValue([]);

      await controller.listExperiments("ws_123", { type: "pricing" });

      expect(experimentsService.listExperiments).toHaveBeenCalledWith(
        "ws_123",
        { status: undefined, type: "pricing" },
      );
    });

    it("should filter by both status and type", async () => {
      experimentsService.listExperiments.mockResolvedValue([]);

      await controller.listExperiments("ws_123", {
        status: "running",
        type: "feature",
      });

      expect(experimentsService.listExperiments).toHaveBeenCalledWith(
        "ws_123",
        { status: "running", type: "feature" },
      );
    });
  });

  describe("getExperiment", () => {
    it("should return experiment by ID", async () => {
      experimentsService.getExperiment.mockResolvedValue(mockExperiment);

      const result = await controller.getExperiment("ws_123", "exp_123");

      expect(experimentsService.getExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
      );
      expect(result.id).toBe("exp_123");
    });

    it("should throw NotFoundException when experiment not found", async () => {
      experimentsService.getExperiment.mockResolvedValue(null);

      await expect(
        controller.getExperiment("ws_123", "exp_nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getExperimentByKey", () => {
    it("should return experiment by key", async () => {
      experimentsService.getExperimentByKey.mockResolvedValue(mockExperiment);

      const result = await controller.getExperimentByKey(
        "ws_123",
        "pricing-page-v2",
      );

      expect(experimentsService.getExperimentByKey).toHaveBeenCalledWith(
        "ws_123",
        "pricing-page-v2",
      );
      expect(result.key).toBe("pricing-page-v2");
    });

    it("should throw NotFoundException when experiment not found by key", async () => {
      experimentsService.getExperimentByKey.mockResolvedValue(null);

      await expect(
        controller.getExperimentByKey("ws_123", "nonexistent-key"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateExperiment", () => {
    it("should update experiment", async () => {
      const updatedExperiment = {
        ...mockExperiment,
        name: "Updated Name",
        trafficAllocation: 75,
      };
      experimentsService.updateExperiment.mockResolvedValue(updatedExperiment);

      const result = await controller.updateExperiment("ws_123", "exp_123", {
        name: "Updated Name",
        trafficAllocation: 75,
      });

      expect(experimentsService.updateExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        expect.objectContaining({
          name: "Updated Name",
          trafficAllocation: 75,
        }),
      );
      expect(result.name).toBe("Updated Name");
    });

    it("should handle date updates", async () => {
      experimentsService.updateExperiment.mockResolvedValue(mockExperiment);

      await controller.updateExperiment("ws_123", "exp_123", {
        startAt: "2024-01-01",
        endAt: "2024-02-01",
      });

      expect(experimentsService.updateExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        expect.objectContaining({
          startAt: expect.any(Date),
          endAt: expect.any(Date),
        }),
      );
    });
  });

  describe("startExperiment", () => {
    it("should start an experiment", async () => {
      const runningExperiment = { ...mockExperiment, status: "running" };
      experimentsService.startExperiment.mockResolvedValue(runningExperiment);

      const result = await controller.startExperiment("ws_123", "exp_123");

      expect(experimentsService.startExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
      );
      expect(result.status).toBe("running");
    });
  });

  describe("pauseExperiment", () => {
    it("should pause an experiment", async () => {
      const pausedExperiment = { ...mockExperiment, status: "paused" };
      experimentsService.pauseExperiment.mockResolvedValue(pausedExperiment);

      const result = await controller.pauseExperiment("ws_123", "exp_123");

      expect(experimentsService.pauseExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
      );
      expect(result.status).toBe("paused");
    });
  });

  describe("concludeExperiment", () => {
    it("should conclude experiment without winner", async () => {
      const concludedExperiment = { ...mockExperiment, status: "concluded" };
      experimentsService.concludeExperiment.mockResolvedValue(
        concludedExperiment,
      );

      const result = await controller.concludeExperiment(
        "ws_123",
        "exp_123",
        {},
      );

      expect(experimentsService.concludeExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        undefined,
      );
      expect(result.status).toBe("concluded");
    });

    it("should conclude experiment with winning variant", async () => {
      const concludedExperiment = {
        ...mockExperiment,
        status: "concluded",
        winningVariantId: "var_456",
      };
      experimentsService.concludeExperiment.mockResolvedValue(
        concludedExperiment,
      );

      const result = await controller.concludeExperiment("ws_123", "exp_123", {
        winningVariantId: "var_456",
      });

      expect(experimentsService.concludeExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        "var_456",
      );
      expect(result.winningVariantId).toBe("var_456");
    });
  });

  describe("archiveExperiment", () => {
    it("should archive an experiment", async () => {
      const archivedExperiment = { ...mockExperiment, status: "archived" };
      experimentsService.archiveExperiment.mockResolvedValue(
        archivedExperiment,
      );

      const result = await controller.archiveExperiment("ws_123", "exp_123");

      expect(experimentsService.archiveExperiment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
      );
      expect(result.status).toBe("archived");
    });
  });

  // =========================================================================
  // VARIANT MANAGEMENT
  // =========================================================================

  describe("addVariant", () => {
    it("should add a variant to experiment", async () => {
      experimentsService.addVariant.mockResolvedValue(mockVariant);

      const result = await controller.addVariant("ws_123", "exp_123", {
        key: "control",
        name: "Control Group",
        description: "Original experience",
        weight: 1,
        config: { buttonColor: "blue" },
        isControl: true,
      });

      expect(experimentsService.addVariant).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        expect.objectContaining({
          key: "control",
          name: "Control Group",
          isControl: true,
        }),
      );
      expect(result.key).toBe("control");
    });

    it("should add variant with minimal options", async () => {
      experimentsService.addVariant.mockResolvedValue(mockVariant);

      await controller.addVariant("ws_123", "exp_123", {
        key: "treatment",
        name: "Treatment Group",
      });

      expect(experimentsService.addVariant).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        { key: "treatment", name: "Treatment Group" },
      );
    });
  });

  describe("updateVariant", () => {
    it("should update a variant", async () => {
      const updatedVariant = { ...mockVariant, weight: 2 };
      experimentsService.updateVariant.mockResolvedValue(updatedVariant);

      const result = await controller.updateVariant(
        "ws_123",
        "exp_123",
        "var_123",
        { weight: 2 },
      );

      expect(experimentsService.updateVariant).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        "var_123",
        { weight: 2 },
      );
      expect(result.weight).toBe(2);
    });

    it("should update variant config", async () => {
      const updatedVariant = {
        ...mockVariant,
        config: { buttonColor: "green" },
      };
      experimentsService.updateVariant.mockResolvedValue(updatedVariant);

      const result = await controller.updateVariant(
        "ws_123",
        "exp_123",
        "var_123",
        { config: { buttonColor: "green" } },
      );

      expect(result.config).toEqual({ buttonColor: "green" });
    });
  });

  describe("deleteVariant", () => {
    it("should delete a variant", async () => {
      experimentsService.deleteVariant.mockResolvedValue(undefined);

      await controller.deleteVariant("ws_123", "exp_123", "var_123");

      expect(experimentsService.deleteVariant).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        "var_123",
      );
    });
  });

  // =========================================================================
  // ASSIGNMENT & BUCKETING
  // =========================================================================

  describe("getAssignment", () => {
    it("should get assignment for customer", async () => {
      experimentsService.getAssignment.mockResolvedValue(mockAssignment);

      const result = await controller.getAssignment(
        "ws_123",
        "pricing-page-v2",
        { customerId: "cust_123" },
      );

      expect(experimentsService.getAssignment).toHaveBeenCalledWith(
        "ws_123",
        "pricing-page-v2",
        {
          customerId: "cust_123",
          sessionId: undefined,
          userId: undefined,
          attributes: undefined,
        },
      );
      expect(result?.variantKey).toBe("control");
      expect(result?.isNewAssignment).toBe(true);
    });

    it("should return null when no assignment", async () => {
      experimentsService.getAssignment.mockResolvedValue(null);

      const result = await controller.getAssignment(
        "ws_123",
        "pricing-page-v2",
        { customerId: "cust_123" },
      );

      expect(result).toBeNull();
    });

    it("should pass attributes for targeting", async () => {
      experimentsService.getAssignment.mockResolvedValue(mockAssignment);

      await controller.getAssignment("ws_123", "pricing-page-v2", {
        customerId: "cust_123",
        attributes: { plan: "pro", country: "US" },
      });

      expect(experimentsService.getAssignment).toHaveBeenCalledWith(
        "ws_123",
        "pricing-page-v2",
        expect.objectContaining({
          attributes: { plan: "pro", country: "US" },
        }),
      );
    });
  });

  describe("getActiveAssignments", () => {
    it("should get all active assignments", async () => {
      experimentsService.getActiveAssignments.mockResolvedValue([
        mockAssignment,
        { ...mockAssignment, experimentKey: "checkout-flow-test" },
      ]);

      const result = await controller.getActiveAssignments("ws_123", {
        customerId: "cust_123",
      });

      expect(experimentsService.getActiveAssignments).toHaveBeenCalledWith(
        "ws_123",
        {
          customerId: "cust_123",
          sessionId: undefined,
          userId: undefined,
          attributes: undefined,
        },
      );
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no active experiments", async () => {
      experimentsService.getActiveAssignments.mockResolvedValue([]);

      const result = await controller.getActiveAssignments("ws_123", {
        customerId: "cust_123",
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("overrideAssignment", () => {
    it("should override assignment", async () => {
      experimentsService.overrideAssignment.mockResolvedValue(mockAssignment);

      const result = await controller.overrideAssignment("ws_123", "exp_123", {
        variantId: "var_456",
        customerId: "cust_123",
      });

      expect(experimentsService.overrideAssignment).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
        "var_456",
        { customerId: "cust_123", sessionId: undefined, userId: undefined },
      );
      expect(result.assignmentId).toBe("assign_123");
    });
  });

  // =========================================================================
  // CONVERSION TRACKING
  // =========================================================================

  describe("recordConversion", () => {
    it("should record conversion", async () => {
      experimentsService.recordConversion.mockResolvedValue(true);

      const result = await controller.recordConversion(
        "ws_123",
        "pricing-page-v2",
        { customerId: "cust_123" },
      );

      expect(experimentsService.recordConversion).toHaveBeenCalledWith(
        "ws_123",
        "pricing-page-v2",
        {
          customerId: "cust_123",
          sessionId: undefined,
          userId: undefined,
          value: undefined,
          metadata: undefined,
        },
      );
      expect(result).toBe(true);
    });

    it("should record conversion with value", async () => {
      experimentsService.recordConversion.mockResolvedValue(true);

      await controller.recordConversion("ws_123", "pricing-page-v2", {
        customerId: "cust_123",
        value: 9900,
        metadata: { plan: "pro" },
      });

      expect(experimentsService.recordConversion).toHaveBeenCalledWith(
        "ws_123",
        "pricing-page-v2",
        expect.objectContaining({
          value: 9900,
          metadata: { plan: "pro" },
        }),
      );
    });

    it("should return false when already converted", async () => {
      experimentsService.recordConversion.mockResolvedValue(false);

      const result = await controller.recordConversion(
        "ws_123",
        "pricing-page-v2",
        { customerId: "cust_123" },
      );

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // STATISTICS
  // =========================================================================

  describe("getExperimentStats", () => {
    it("should return experiment statistics", async () => {
      experimentsService.getExperimentStats.mockResolvedValue(mockStats);

      const result = await controller.getExperimentStats("ws_123", "exp_123");

      expect(experimentsService.getExperimentStats).toHaveBeenCalledWith(
        "ws_123",
        "exp_123",
      );
      expect(result.experimentId).toBe("exp_123");
      expect(result.totalAssignments).toBe(1000);
      expect(result.conversionRate).toBe(0.105);
    });

    it("should return per-variant statistics", async () => {
      experimentsService.getExperimentStats.mockResolvedValue(mockStats);

      const result = await controller.getExperimentStats("ws_123", "exp_123");

      expect(result.variantStats).toHaveLength(2);
      expect(result.variantStats[0].variantKey).toBe("control");
      expect(result.variantStats[0].conversionRate).toBe(0.095);
      expect(result.variantStats[1].variantKey).toBe("treatment");
      expect(result.variantStats[1].conversionRate).toBe(0.116);
    });
  });
});
