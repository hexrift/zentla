import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  ExperimentType,
  ExperimentStatus,
  Experiment,
  ExperimentVariant,
} from "@prisma/client";
import * as crypto from "crypto";

/**
 * Result of getting an experiment assignment.
 */
export interface ExperimentAssignmentResult {
  experimentKey: string;
  variantKey: string;
  variantConfig: Record<string, unknown>;
  isControl: boolean;
  assignmentId: string;
  isNewAssignment: boolean;
}

/**
 * Options for creating an experiment.
 */
export interface CreateExperimentOptions {
  key: string;
  name: string;
  description?: string;
  type?: ExperimentType;
  trafficAllocation?: number;
  targetingRules?: Record<string, unknown>;
  startAt?: Date;
  endAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a variant.
 */
export interface CreateVariantOptions {
  key: string;
  name: string;
  description?: string;
  weight?: number;
  config?: Record<string, unknown>;
  isControl?: boolean;
}

/**
 * Options for getting an assignment.
 */
export interface GetAssignmentOptions {
  customerId?: string;
  sessionId?: string;
  userId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Experiment with variants included.
 */
export interface ExperimentWithVariants extends Experiment {
  variants: ExperimentVariant[];
}

/**
 * Statistics for an experiment.
 */
export interface ExperimentStats {
  experimentId: string;
  totalAssignments: number;
  totalExposures: number;
  totalConversions: number;
  conversionRate: number;
  variantStats: Array<{
    variantId: string;
    variantKey: string;
    isControl: boolean;
    assignments: number;
    exposures: number;
    conversions: number;
    conversionRate: number;
    totalConversionValue: number;
  }>;
}

@Injectable()
export class ExperimentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new experiment.
   */
  async createExperiment(
    workspaceId: string,
    options: CreateExperimentOptions,
  ): Promise<ExperimentWithVariants> {
    // Check for duplicate key
    const existing = await this.prisma.experiment.findUnique({
      where: {
        workspaceId_key: {
          workspaceId,
          key: options.key,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Experiment with key '${options.key}' already exists`,
      );
    }

    const experiment = await this.prisma.experiment.create({
      data: {
        workspaceId,
        key: options.key,
        name: options.name,
        description: options.description,
        type: options.type || "feature",
        trafficAllocation: options.trafficAllocation ?? 100,
        targetingRules: (options.targetingRules ?? {}) as object,
        startAt: options.startAt,
        endAt: options.endAt,
        metadata: (options.metadata ?? {}) as object,
      },
      include: { variants: true },
    });

    return experiment;
  }

  /**
   * Get an experiment by ID.
   */
  async getExperiment(
    workspaceId: string,
    experimentId: string,
  ): Promise<ExperimentWithVariants | null> {
    return this.prisma.experiment.findFirst({
      where: { id: experimentId, workspaceId },
      include: { variants: true },
    });
  }

  /**
   * Get an experiment by key.
   */
  async getExperimentByKey(
    workspaceId: string,
    key: string,
  ): Promise<ExperimentWithVariants | null> {
    return this.prisma.experiment.findUnique({
      where: {
        workspaceId_key: {
          workspaceId,
          key,
        },
      },
      include: { variants: true },
    });
  }

  /**
   * List experiments for a workspace.
   */
  async listExperiments(
    workspaceId: string,
    filters?: {
      status?: ExperimentStatus;
      type?: ExperimentType;
    },
  ): Promise<ExperimentWithVariants[]> {
    const where: Record<string, unknown> = { workspaceId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    return this.prisma.experiment.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update an experiment.
   */
  async updateExperiment(
    workspaceId: string,
    experimentId: string,
    updates: Partial<{
      name: string;
      description: string;
      trafficAllocation: number;
      targetingRules: Record<string, unknown>;
      startAt: Date | null;
      endAt: Date | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<ExperimentWithVariants> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    // Don't allow updates to running experiments (except pause/conclude)
    if (
      experiment.status === "running" &&
      updates.trafficAllocation !== undefined
    ) {
      // Allow traffic allocation changes during running
    }

    const data: Record<string, unknown> = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.trafficAllocation !== undefined)
      data.trafficAllocation = updates.trafficAllocation;
    if (updates.targetingRules !== undefined)
      data.targetingRules = updates.targetingRules as object;
    if (updates.startAt !== undefined) data.startAt = updates.startAt;
    if (updates.endAt !== undefined) data.endAt = updates.endAt;
    if (updates.metadata !== undefined)
      data.metadata = updates.metadata as object;

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data,
      include: { variants: true },
    });
  }

  /**
   * Start an experiment.
   */
  async startExperiment(
    workspaceId: string,
    experimentId: string,
  ): Promise<ExperimentWithVariants> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== "draft" && experiment.status !== "paused") {
      throw new BadRequestException(
        `Cannot start experiment in status '${experiment.status}'`,
      );
    }

    if (experiment.variants.length < 2) {
      throw new BadRequestException(
        "Experiment must have at least 2 variants to start",
      );
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: "running",
        startAt: experiment.startAt || new Date(),
      },
      include: { variants: true },
    });
  }

  /**
   * Pause an experiment.
   */
  async pauseExperiment(
    workspaceId: string,
    experimentId: string,
  ): Promise<ExperimentWithVariants> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== "running") {
      throw new BadRequestException(
        `Cannot pause experiment in status '${experiment.status}'`,
      );
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: "paused" },
      include: { variants: true },
    });
  }

  /**
   * Conclude an experiment with a winning variant.
   */
  async concludeExperiment(
    workspaceId: string,
    experimentId: string,
    winningVariantId?: string,
  ): Promise<ExperimentWithVariants> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== "running" && experiment.status !== "paused") {
      throw new BadRequestException(
        `Cannot conclude experiment in status '${experiment.status}'`,
      );
    }

    if (winningVariantId) {
      const variant = experiment.variants.find(
        (v) => v.id === winningVariantId,
      );
      if (!variant) {
        throw new BadRequestException(
          `Variant ${winningVariantId} not found in experiment`,
        );
      }
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: "concluded",
        winningVariantId,
        concludedAt: new Date(),
        endAt: experiment.endAt || new Date(),
      },
      include: { variants: true },
    });
  }

  /**
   * Archive an experiment.
   */
  async archiveExperiment(
    workspaceId: string,
    experimentId: string,
  ): Promise<ExperimentWithVariants> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: "archived" },
      include: { variants: true },
    });
  }

  // =========================================================================
  // VARIANT MANAGEMENT
  // =========================================================================

  /**
   * Add a variant to an experiment.
   */
  async addVariant(
    workspaceId: string,
    experimentId: string,
    options: CreateVariantOptions,
  ): Promise<ExperimentVariant> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== "draft") {
      throw new BadRequestException(
        "Cannot add variants to a non-draft experiment",
      );
    }

    // Check for duplicate key
    const existing = experiment.variants.find((v) => v.key === options.key);
    if (existing) {
      throw new ConflictException(
        `Variant with key '${options.key}' already exists`,
      );
    }

    return this.prisma.experimentVariant.create({
      data: {
        experimentId,
        key: options.key,
        name: options.name,
        description: options.description,
        weight: options.weight ?? 1,
        config: (options.config ?? {}) as object,
        isControl: options.isControl ?? false,
      },
    });
  }

  /**
   * Update a variant.
   */
  async updateVariant(
    workspaceId: string,
    experimentId: string,
    variantId: string,
    updates: Partial<{
      name: string;
      description: string;
      weight: number;
      config: Record<string, unknown>;
    }>,
  ): Promise<ExperimentVariant> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    const data: Record<string, unknown> = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.weight !== undefined) data.weight = updates.weight;
    if (updates.config !== undefined) data.config = updates.config as object;

    return this.prisma.experimentVariant.update({
      where: { id: variantId },
      data,
    });
  }

  /**
   * Delete a variant.
   */
  async deleteVariant(
    workspaceId: string,
    experimentId: string,
    variantId: string,
  ): Promise<void> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== "draft") {
      throw new BadRequestException(
        "Cannot delete variants from a non-draft experiment",
      );
    }

    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    await this.prisma.experimentVariant.delete({
      where: { id: variantId },
    });
  }

  // =========================================================================
  // ASSIGNMENT & BUCKETING
  // =========================================================================

  /**
   * Get or create an experiment assignment for a subject.
   * Uses deterministic bucketing based on experiment key + subject ID.
   */
  async getAssignment(
    workspaceId: string,
    experimentKey: string,
    options: GetAssignmentOptions,
  ): Promise<ExperimentAssignmentResult | null> {
    const experiment = await this.getExperimentByKey(
      workspaceId,
      experimentKey,
    );

    if (!experiment) {
      return null;
    }

    // Only assign to running experiments
    if (experiment.status !== "running") {
      // If concluded, return the winning variant
      if (experiment.status === "concluded" && experiment.winningVariantId) {
        const winningVariant = experiment.variants.find(
          (v) => v.id === experiment.winningVariantId,
        );
        if (winningVariant) {
          return {
            experimentKey,
            variantKey: winningVariant.key,
            variantConfig: winningVariant.config as Record<string, unknown>,
            isControl: winningVariant.isControl,
            assignmentId: "concluded",
            isNewAssignment: false,
          };
        }
      }
      return null;
    }

    // Check targeting rules
    if (!this.matchesTargetingRules(experiment, options.attributes)) {
      return null;
    }

    // Check traffic allocation
    const subjectId = options.customerId || options.sessionId || options.userId;
    if (!subjectId) {
      throw new BadRequestException(
        "Must provide customerId, sessionId, or userId for assignment",
      );
    }

    if (!this.isInTrafficAllocation(experiment, subjectId)) {
      return null;
    }

    // Check for existing assignment
    const existingAssignment = await this.findExistingAssignment(
      experiment.id,
      options,
    );

    if (existingAssignment) {
      const variant = experiment.variants.find(
        (v) => v.id === existingAssignment.variantId,
      );
      if (variant) {
        // Update exposure tracking
        await this.recordExposure(existingAssignment.id);

        return {
          experimentKey,
          variantKey: variant.key,
          variantConfig: variant.config as Record<string, unknown>,
          isControl: variant.isControl,
          assignmentId: existingAssignment.id,
          isNewAssignment: false,
        };
      }
    }

    // Create new assignment
    const variant = this.selectVariant(
      experiment.variants,
      subjectId,
      experimentKey,
    );

    const assignment = await this.prisma.experimentAssignment.create({
      data: {
        workspaceId,
        experimentId: experiment.id,
        variantId: variant.id,
        customerId: options.customerId,
        sessionId: options.sessionId,
        userId: options.userId,
        source: "auto",
        firstExposureAt: new Date(),
        lastExposureAt: new Date(),
        exposureCount: 1,
        metadata: {},
      },
    });

    return {
      experimentKey,
      variantKey: variant.key,
      variantConfig: variant.config as Record<string, unknown>,
      isControl: variant.isControl,
      assignmentId: assignment.id,
      isNewAssignment: true,
    };
  }

  /**
   * Get all active experiment assignments for a subject.
   */
  async getActiveAssignments(
    workspaceId: string,
    options: GetAssignmentOptions,
  ): Promise<ExperimentAssignmentResult[]> {
    // Get all running experiments
    const experiments = await this.listExperiments(workspaceId, {
      status: "running",
    });

    const assignments: ExperimentAssignmentResult[] = [];

    for (const experiment of experiments) {
      const assignment = await this.getAssignment(
        workspaceId,
        experiment.key,
        options,
      );
      if (assignment) {
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Override an assignment (for testing or manual assignment).
   */
  async overrideAssignment(
    workspaceId: string,
    experimentId: string,
    variantId: string,
    options: GetAssignmentOptions,
  ): Promise<ExperimentAssignmentResult> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    // Delete existing assignment if any
    await this.prisma.experimentAssignment.deleteMany({
      where: {
        experimentId,
        OR: [
          options.customerId ? { customerId: options.customerId } : {},
          options.sessionId ? { sessionId: options.sessionId } : {},
        ].filter((o) => Object.keys(o).length > 0),
      },
    });

    // Create override assignment
    const assignment = await this.prisma.experimentAssignment.create({
      data: {
        workspaceId,
        experimentId,
        variantId,
        customerId: options.customerId,
        sessionId: options.sessionId,
        userId: options.userId,
        source: "override",
        metadata: {},
      },
    });

    return {
      experimentKey: experiment.key,
      variantKey: variant.key,
      variantConfig: variant.config as Record<string, unknown>,
      isControl: variant.isControl,
      assignmentId: assignment.id,
      isNewAssignment: true,
    };
  }

  // =========================================================================
  // CONVERSION TRACKING
  // =========================================================================

  /**
   * Record a conversion for an assignment.
   */
  async recordConversion(
    workspaceId: string,
    experimentKey: string,
    options: GetAssignmentOptions & {
      value?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<boolean> {
    const experiment = await this.getExperimentByKey(
      workspaceId,
      experimentKey,
    );

    if (!experiment) {
      return false;
    }

    const assignment = await this.findExistingAssignment(
      experiment.id,
      options,
    );

    if (!assignment) {
      return false;
    }

    // Don't record duplicate conversions
    if (assignment.convertedAt) {
      return false;
    }

    await this.prisma.experimentAssignment.update({
      where: { id: assignment.id },
      data: {
        convertedAt: new Date(),
        conversionValue: options.value,
        conversionMetadata: options.metadata as object,
      },
    });

    return true;
  }

  // =========================================================================
  // STATISTICS
  // =========================================================================

  /**
   * Get statistics for an experiment.
   */
  async getExperimentStats(
    workspaceId: string,
    experimentId: string,
  ): Promise<ExperimentStats> {
    const experiment = await this.getExperiment(workspaceId, experimentId);

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    // Get all assignments
    const assignments = await this.prisma.experimentAssignment.findMany({
      where: { experimentId },
    });

    const variantStats = experiment.variants.map((variant) => {
      const variantAssignments = assignments.filter(
        (a) => a.variantId === variant.id,
      );
      const exposures = variantAssignments.filter(
        (a) => a.exposureCount > 0,
      ).length;
      const conversions = variantAssignments.filter(
        (a) => a.convertedAt !== null,
      ).length;
      const totalValue = variantAssignments.reduce(
        (sum, a) => sum + (a.conversionValue?.toNumber() ?? 0),
        0,
      );

      return {
        variantId: variant.id,
        variantKey: variant.key,
        isControl: variant.isControl,
        assignments: variantAssignments.length,
        exposures,
        conversions,
        conversionRate: exposures > 0 ? conversions / exposures : 0,
        totalConversionValue: totalValue,
      };
    });

    const totalAssignments = assignments.length;
    const totalExposures = assignments.filter(
      (a) => a.exposureCount > 0,
    ).length;
    const totalConversions = assignments.filter(
      (a) => a.convertedAt !== null,
    ).length;

    return {
      experimentId,
      totalAssignments,
      totalExposures,
      totalConversions,
      conversionRate:
        totalExposures > 0 ? totalConversions / totalExposures : 0,
      variantStats,
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private matchesTargetingRules(
    experiment: ExperimentWithVariants,
    attributes?: Record<string, unknown>,
  ): boolean {
    const rules = experiment.targetingRules as Record<string, unknown>;

    // No rules means all traffic matches
    if (!rules || Object.keys(rules).length === 0) {
      return true;
    }

    if (!attributes) {
      return false;
    }

    // Simple attribute matching
    for (const [key, value] of Object.entries(rules)) {
      if (attributes[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private isInTrafficAllocation(
    experiment: ExperimentWithVariants,
    subjectId: string,
  ): boolean {
    if (experiment.trafficAllocation >= 100) {
      return true;
    }

    // Use hash of experiment key + subject ID for deterministic allocation
    const hash = this.hashString(`${experiment.key}:traffic:${subjectId}`);
    const bucket = hash % 100;

    return bucket < experiment.trafficAllocation;
  }

  private selectVariant(
    variants: ExperimentVariant[],
    subjectId: string,
    experimentKey: string,
  ): ExperimentVariant {
    // Calculate total weight
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

    // Use hash for deterministic variant selection
    const hash = this.hashString(`${experimentKey}:variant:${subjectId}`);
    const bucket = hash % totalWeight;

    // Select variant based on bucket
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant;
      }
    }

    // Fallback to last variant
    return variants[variants.length - 1];
  }

  private hashString(str: string): number {
    const hash = crypto.createHash("md5").update(str).digest("hex");
    // Convert first 8 chars of hex to number
    return parseInt(hash.substring(0, 8), 16);
  }

  private async findExistingAssignment(
    experimentId: string,
    options: GetAssignmentOptions,
  ) {
    const conditions: Array<Record<string, string>> = [];

    if (options.customerId) {
      conditions.push({ customerId: options.customerId });
    }
    if (options.sessionId) {
      conditions.push({ sessionId: options.sessionId });
    }

    if (conditions.length === 0) {
      return null;
    }

    return this.prisma.experimentAssignment.findFirst({
      where: {
        experimentId,
        OR: conditions,
      },
    });
  }

  private async recordExposure(assignmentId: string): Promise<void> {
    await this.prisma.experimentAssignment.update({
      where: { id: assignmentId },
      data: {
        lastExposureAt: new Date(),
        exposureCount: { increment: 1 },
      },
    });
  }
}
