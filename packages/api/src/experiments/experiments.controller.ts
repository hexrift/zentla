import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import type { ExperimentStatus, ExperimentType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { MemberOnly, WorkspaceId } from "../common/decorators";
import { ExperimentsService } from "./experiments.service";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CreateExperimentDto {
  @ApiProperty({
    description: "Unique key for the experiment",
    example: "pricing-page-v2",
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: "Human-readable name",
    example: "Pricing Page V2 Test",
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: "Description of the experiment",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Experiment type",
    enum: ["feature", "pricing", "ui", "funnel"],
    default: "feature",
  })
  @IsOptional()
  @IsString()
  type?: ExperimentType;

  @ApiPropertyOptional({
    description: "Percentage of traffic to include (0-100)",
    default: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  trafficAllocation?: number;

  @ApiPropertyOptional({
    description: "Targeting rules for the experiment",
    example: { plan: "pro", country: "US" },
  })
  @IsOptional()
  @IsObject()
  targetingRules?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Scheduled start date (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({
    description: "Scheduled end date (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({
    description: "Additional metadata",
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateExperimentDto {
  @ApiPropertyOptional({ description: "Human-readable name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Description of the experiment" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Percentage of traffic to include (0-100)",
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  trafficAllocation?: number;

  @ApiPropertyOptional({ description: "Targeting rules" })
  @IsOptional()
  @IsObject()
  targetingRules?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Scheduled start date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: "Scheduled end date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: "Additional metadata" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class CreateVariantDto {
  @ApiProperty({
    description: "Unique key for the variant within the experiment",
    example: "control",
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: "Human-readable name",
    example: "Control Group",
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: "Description of the variant" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Weight for traffic distribution (relative to other variants)",
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weight?: number;

  @ApiPropertyOptional({
    description: "Configuration object for this variant",
    example: { buttonColor: "blue", showBanner: true },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Whether this is the control variant",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isControl?: boolean;
}

class UpdateVariantDto {
  @ApiPropertyOptional({ description: "Human-readable name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Description of the variant" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Weight for traffic distribution" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weight?: number;

  @ApiPropertyOptional({ description: "Configuration object" })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

class GetAssignmentDto {
  @ApiPropertyOptional({ description: "Customer ID for assignment" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: "Session ID for assignment" })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: "User ID for assignment" })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: "Attributes for targeting evaluation",
    example: { plan: "pro", country: "US" },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

class RecordConversionDto {
  @ApiPropertyOptional({ description: "Customer ID" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: "Session ID" })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: "User ID" })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: "Conversion value (e.g., revenue in cents)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @ApiPropertyOptional({ description: "Additional conversion metadata" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class ConcludeExperimentDto {
  @ApiPropertyOptional({
    description: "ID of the winning variant (optional)",
  })
  @IsOptional()
  @IsString()
  winningVariantId?: string;
}

class OverrideAssignmentDto {
  @ApiProperty({ description: "ID of the variant to assign" })
  @IsString()
  variantId!: string;

  @ApiPropertyOptional({ description: "Customer ID" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: "Session ID" })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: "User ID" })
  @IsOptional()
  @IsString()
  userId?: string;
}

class ListExperimentsDto {
  @ApiPropertyOptional({
    description: "Filter by status",
    enum: ["draft", "running", "paused", "concluded", "archived"],
  })
  @IsOptional()
  @IsString()
  status?: ExperimentStatus;

  @ApiPropertyOptional({
    description: "Filter by type",
    enum: ["feature", "pricing", "ui", "funnel"],
  })
  @IsOptional()
  @IsString()
  type?: ExperimentType;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

class VariantSchema {
  @ApiProperty({ description: "Variant ID" })
  id!: string;

  @ApiProperty({ description: "Variant key" })
  key!: string;

  @ApiProperty({ description: "Variant name" })
  name!: string;

  @ApiPropertyOptional({ description: "Description" })
  description?: string | null;

  @ApiProperty({ description: "Traffic weight" })
  weight!: number;

  @ApiProperty({ description: "Variant configuration" })
  config!: Record<string, unknown> | null;

  @ApiProperty({ description: "Is control variant" })
  isControl!: boolean;
}

class ExperimentSchema {
  @ApiProperty({ description: "Experiment ID" })
  id!: string;

  @ApiProperty({ description: "Experiment key" })
  key!: string;

  @ApiProperty({ description: "Experiment name" })
  name!: string;

  @ApiPropertyOptional({ description: "Description" })
  description?: string | null;

  @ApiProperty({
    description: "Experiment type",
    enum: ["feature", "pricing", "ui", "funnel"],
  })
  type!: ExperimentType;

  @ApiProperty({
    description: "Experiment status",
    enum: ["draft", "running", "paused", "concluded", "archived"],
  })
  status!: ExperimentStatus;

  @ApiProperty({ description: "Traffic allocation percentage" })
  trafficAllocation!: number;

  @ApiProperty({ description: "Targeting rules" })
  targetingRules!: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: "Start date" })
  startAt?: Date | null;

  @ApiPropertyOptional({ description: "End date" })
  endAt?: Date | null;

  @ApiPropertyOptional({ description: "Winning variant ID (when concluded)" })
  winningVariantId?: string | null;

  @ApiProperty({ description: "Experiment variants", type: [VariantSchema] })
  variants!: VariantSchema[];

  @ApiProperty({ description: "Created timestamp" })
  createdAt!: Date;

  @ApiProperty({ description: "Updated timestamp" })
  updatedAt!: Date;
}

class AssignmentSchema {
  @ApiProperty({ description: "Experiment key" })
  experimentKey!: string;

  @ApiProperty({ description: "Assigned variant key" })
  variantKey!: string;

  @ApiProperty({ description: "Variant configuration" })
  variantConfig!: Record<string, unknown> | null;

  @ApiProperty({ description: "Is control variant" })
  isControl!: boolean;

  @ApiProperty({ description: "Assignment ID" })
  assignmentId!: string;

  @ApiProperty({ description: "Whether this is a new assignment" })
  isNewAssignment!: boolean;
}

class VariantStatsSchema {
  @ApiProperty({ description: "Variant ID" })
  variantId!: string;

  @ApiProperty({ description: "Variant key" })
  variantKey!: string;

  @ApiProperty({ description: "Is control variant" })
  isControl!: boolean;

  @ApiProperty({ description: "Total assignments" })
  assignments!: number;

  @ApiProperty({ description: "Total exposures" })
  exposures!: number;

  @ApiProperty({ description: "Total conversions" })
  conversions!: number;

  @ApiProperty({ description: "Conversion rate (0-1)" })
  conversionRate!: number;

  @ApiProperty({ description: "Total conversion value" })
  totalConversionValue!: number;
}

class ExperimentStatsSchema {
  @ApiProperty({ description: "Experiment ID" })
  experimentId!: string;

  @ApiProperty({ description: "Total assignments across all variants" })
  totalAssignments!: number;

  @ApiProperty({ description: "Total exposures across all variants" })
  totalExposures!: number;

  @ApiProperty({ description: "Total conversions across all variants" })
  totalConversions!: number;

  @ApiProperty({ description: "Overall conversion rate (0-1)" })
  conversionRate!: number;

  @ApiProperty({
    description: "Per-variant statistics",
    type: [VariantStatsSchema],
  })
  variantStats!: VariantStatsSchema[];
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("experiments")
@ApiSecurity("api-key")
@Controller("experiments")
@MemberOnly()
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  // =========================================================================
  // EXPERIMENT MANAGEMENT
  // =========================================================================

  @Post()
  @ApiOperation({
    summary: "Create a new experiment",
    description: `Creates a new A/B test experiment in draft status.

**Workflow:**
1. Create experiment with key, name, and configuration
2. Add variants (minimum 2 required)
3. Start the experiment to begin traffic allocation

**Traffic Allocation:** Percentage of eligible traffic to include in the experiment (0-100).

**Targeting Rules:** Key-value pairs that must match subject attributes for inclusion.`,
  })
  @ApiBody({ type: CreateExperimentDto })
  @ApiResponse({
    status: 201,
    description: "Experiment created",
    type: ExperimentSchema,
  })
  async createExperiment(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateExperimentDto,
  ) {
    return this.experimentsService.createExperiment(workspaceId, {
      ...dto,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    });
  }

  @Get()
  @ApiOperation({
    summary: "List experiments",
    description: `Returns all experiments for the workspace with optional filtering.

**Statuses:**
- \`draft\`: Experiment created but not started
- \`running\`: Actively assigning traffic
- \`paused\`: Temporarily stopped
- \`concluded\`: Experiment ended with optional winner
- \`archived\`: Permanently archived`,
  })
  @ApiResponse({
    status: 200,
    description: "List of experiments",
    type: [ExperimentSchema],
  })
  async listExperiments(
    @WorkspaceId() workspaceId: string,
    @Query() query: ListExperimentsDto,
  ) {
    return this.experimentsService.listExperiments(workspaceId, {
      status: query.status,
      type: query.type,
    });
  }

  @Get(":experimentId")
  @ApiOperation({
    summary: "Get an experiment",
    description: "Returns a single experiment by ID with all variants.",
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiResponse({
    status: 200,
    description: "Experiment details",
    type: ExperimentSchema,
  })
  @ApiResponse({ status: 404, description: "Experiment not found" })
  async getExperiment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
  ) {
    const experiment = await this.experimentsService.getExperiment(
      workspaceId,
      experimentId,
    );

    if (!experiment) {
      throw new NotFoundException(`Experiment ${experimentId} not found`);
    }

    return experiment;
  }

  @Get("key/:key")
  @ApiOperation({
    summary: "Get experiment by key",
    description: "Returns an experiment by its unique key.",
  })
  @ApiParam({ name: "key", description: "Experiment key" })
  @ApiResponse({
    status: 200,
    description: "Experiment details",
    type: ExperimentSchema,
  })
  @ApiResponse({ status: 404, description: "Experiment not found" })
  async getExperimentByKey(
    @WorkspaceId() workspaceId: string,
    @Param("key") key: string,
  ) {
    const experiment = await this.experimentsService.getExperimentByKey(
      workspaceId,
      key,
    );

    if (!experiment) {
      throw new NotFoundException(`Experiment with key '${key}' not found`);
    }

    return experiment;
  }

  @Patch(":experimentId")
  @ApiOperation({
    summary: "Update an experiment",
    description: `Updates experiment properties. Some properties can only be modified in draft status.

**Note:** Traffic allocation can be changed while running.`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiBody({ type: UpdateExperimentDto })
  @ApiResponse({
    status: 200,
    description: "Updated experiment",
    type: ExperimentSchema,
  })
  async updateExperiment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
    @Body() dto: UpdateExperimentDto,
  ) {
    return this.experimentsService.updateExperiment(workspaceId, experimentId, {
      ...dto,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    });
  }

  @Post(":experimentId/start")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start an experiment",
    description: `Starts a draft or paused experiment. Traffic will begin being assigned.

**Requirements:**
- Experiment must be in \`draft\` or \`paused\` status
- Must have at least 2 variants`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiResponse({
    status: 200,
    description: "Experiment started",
    type: ExperimentSchema,
  })
  async startExperiment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
  ) {
    return this.experimentsService.startExperiment(workspaceId, experimentId);
  }

  @Post(":experimentId/pause")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Pause an experiment",
    description: `Pauses a running experiment. Existing assignments remain but no new traffic is assigned.

**Note:** Experiment must be in \`running\` status.`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiResponse({
    status: 200,
    description: "Experiment paused",
    type: ExperimentSchema,
  })
  async pauseExperiment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
  ) {
    return this.experimentsService.pauseExperiment(workspaceId, experimentId);
  }

  @Post(":experimentId/conclude")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Conclude an experiment",
    description: `Concludes an experiment, optionally declaring a winning variant.

**Behavior:**
- If a winning variant is specified, all future assignment requests return that variant
- Existing assignments are preserved for analytics`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiBody({ type: ConcludeExperimentDto })
  @ApiResponse({
    status: 200,
    description: "Experiment concluded",
    type: ExperimentSchema,
  })
  async concludeExperiment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
    @Body() dto: ConcludeExperimentDto,
  ) {
    return this.experimentsService.concludeExperiment(
      workspaceId,
      experimentId,
      dto.winningVariantId,
    );
  }

  @Post(":experimentId/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Archive an experiment",
    description:
      "Archives an experiment. Archived experiments are hidden from default listings.",
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiResponse({
    status: 200,
    description: "Experiment archived",
    type: ExperimentSchema,
  })
  async archiveExperiment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
  ) {
    return this.experimentsService.archiveExperiment(workspaceId, experimentId);
  }

  // =========================================================================
  // VARIANT MANAGEMENT
  // =========================================================================

  @Post(":experimentId/variants")
  @ApiOperation({
    summary: "Add a variant",
    description: `Adds a variant to an experiment. Only allowed in draft status.

**Weight:** Relative weight for traffic distribution. A variant with weight 2 gets twice the traffic of weight 1.

**Control:** Mark one variant as control for comparison in statistics.`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiBody({ type: CreateVariantDto })
  @ApiResponse({
    status: 201,
    description: "Variant created",
    type: VariantSchema,
  })
  async addVariant(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.experimentsService.addVariant(workspaceId, experimentId, dto);
  }

  @Patch(":experimentId/variants/:variantId")
  @ApiOperation({
    summary: "Update a variant",
    description:
      "Updates variant properties. Weight changes take effect immediately for new assignments.",
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiParam({ name: "variantId", description: "Variant ID" })
  @ApiBody({ type: UpdateVariantDto })
  @ApiResponse({
    status: 200,
    description: "Updated variant",
    type: VariantSchema,
  })
  async updateVariant(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.experimentsService.updateVariant(
      workspaceId,
      experimentId,
      variantId,
      dto,
    );
  }

  @Delete(":experimentId/variants/:variantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a variant",
    description: "Deletes a variant. Only allowed in draft status.",
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiParam({ name: "variantId", description: "Variant ID" })
  @ApiResponse({ status: 204, description: "Variant deleted" })
  async deleteVariant(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
    @Param("variantId") variantId: string,
  ): Promise<void> {
    await this.experimentsService.deleteVariant(
      workspaceId,
      experimentId,
      variantId,
    );
  }

  // =========================================================================
  // ASSIGNMENT & BUCKETING
  // =========================================================================

  @Post("assign/:experimentKey")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get experiment assignment",
    description: `Gets or creates an assignment for a subject (customer, session, or user).

**Deterministic:** Same subject always gets the same variant for an experiment.

**Targeting:** Subject must match targeting rules to be included.

**Traffic Allocation:** Subject must be in the allocated traffic percentage.

**Returns null if:**
- Experiment not found or not running
- Subject doesn't match targeting rules
- Subject outside traffic allocation`,
  })
  @ApiParam({ name: "experimentKey", description: "Experiment key" })
  @ApiBody({ type: GetAssignmentDto })
  @ApiResponse({
    status: 200,
    description: "Assignment result (or null)",
    type: AssignmentSchema,
  })
  async getAssignment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentKey") experimentKey: string,
    @Body() dto: GetAssignmentDto,
  ) {
    return this.experimentsService.getAssignment(workspaceId, experimentKey, {
      customerId: dto.customerId,
      sessionId: dto.sessionId,
      userId: dto.userId,
      attributes: dto.attributes,
    });
  }

  @Post("assign")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get all active assignments",
    description: `Gets assignments for all running experiments for a subject.

**Use case:** Initial page load to get all experiment configurations at once.`,
  })
  @ApiBody({ type: GetAssignmentDto })
  @ApiResponse({
    status: 200,
    description: "List of assignments",
    type: [AssignmentSchema],
  })
  async getActiveAssignments(
    @WorkspaceId() workspaceId: string,
    @Body() dto: GetAssignmentDto,
  ) {
    return this.experimentsService.getActiveAssignments(workspaceId, {
      customerId: dto.customerId,
      sessionId: dto.sessionId,
      userId: dto.userId,
      attributes: dto.attributes,
    });
  }

  @Post(":experimentId/override")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Override assignment",
    description: `Manually assigns a subject to a specific variant. Useful for testing or VIP treatment.

**Note:** Deletes any existing assignment before creating the override.`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiBody({ type: OverrideAssignmentDto })
  @ApiResponse({
    status: 200,
    description: "Override assignment created",
    type: AssignmentSchema,
  })
  async overrideAssignment(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
    @Body() dto: OverrideAssignmentDto,
  ) {
    return this.experimentsService.overrideAssignment(
      workspaceId,
      experimentId,
      dto.variantId,
      {
        customerId: dto.customerId,
        sessionId: dto.sessionId,
        userId: dto.userId,
      },
    );
  }

  // =========================================================================
  // CONVERSION TRACKING
  // =========================================================================

  @Post("convert/:experimentKey")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Record conversion",
    description: `Records a conversion event for an experiment assignment.

**Deduplication:** Only the first conversion per assignment is recorded.

**Value:** Optional conversion value (e.g., revenue) for calculating total impact.`,
  })
  @ApiParam({ name: "experimentKey", description: "Experiment key" })
  @ApiBody({ type: RecordConversionDto })
  @ApiResponse({
    status: 200,
    description:
      "Conversion recorded (returns false if already converted or no assignment)",
    schema: { type: "boolean" },
  })
  async recordConversion(
    @WorkspaceId() workspaceId: string,
    @Param("experimentKey") experimentKey: string,
    @Body() dto: RecordConversionDto,
  ): Promise<boolean> {
    return this.experimentsService.recordConversion(
      workspaceId,
      experimentKey,
      {
        customerId: dto.customerId,
        sessionId: dto.sessionId,
        userId: dto.userId,
        value: dto.value,
        metadata: dto.metadata,
      },
    );
  }

  // =========================================================================
  // STATISTICS
  // =========================================================================

  @Get(":experimentId/stats")
  @ApiOperation({
    summary: "Get experiment statistics",
    description: `Returns comprehensive statistics for an experiment.

**Metrics include:**
- Total assignments, exposures, and conversions
- Per-variant breakdown
- Conversion rates
- Total conversion value

**Note:** Statistics are calculated in real-time from assignment data.`,
  })
  @ApiParam({ name: "experimentId", description: "Experiment ID" })
  @ApiResponse({
    status: 200,
    description: "Experiment statistics",
    type: ExperimentStatsSchema,
  })
  async getExperimentStats(
    @WorkspaceId() workspaceId: string,
    @Param("experimentId") experimentId: string,
  ) {
    return this.experimentsService.getExperimentStats(
      workspaceId,
      experimentId,
    );
  }
}
