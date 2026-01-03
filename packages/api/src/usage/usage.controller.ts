import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from "@nestjs/swagger";
import { UsageService } from "./usage.service";
import { WorkspaceId, AdminOnly, MemberOnly } from "../common/decorators";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsObject,
  IsEnum,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class IngestEventDto {
  @ApiProperty({ description: "Customer ID", format: "uuid" })
  @IsString()
  customerId!: string;

  @ApiPropertyOptional({ description: "Subscription ID", format: "uuid" })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiProperty({
    description: "Metric key (e.g., api_calls, storage_gb, messages_sent)",
    example: "api_calls",
  })
  @IsString()
  metricKey!: string;

  @ApiProperty({
    description: "Quantity to record",
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({
    description: "Event timestamp (defaults to now)",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({
    description: "Idempotency key to prevent duplicate events",
    example: "evt_abc123",
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: "Additional event properties",
    example: { endpoint: "/api/v1/users", method: "GET" },
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}

class IngestBatchDto {
  @ApiProperty({
    description: "Array of usage events (max 1000)",
    type: [IngestEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}

class QueryEventsDto {
  @ApiPropertyOptional({ description: "Filter by customer ID" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: "Filter by subscription ID" })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ description: "Filter by metric key" })
  @IsOptional()
  @IsString()
  metricKey?: string;

  @ApiPropertyOptional({
    description: "Start date filter",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date filter", format: "date-time" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: "Pagination cursor" })
  @IsOptional()
  @IsString()
  cursor?: string;
}

class CreateMetricDto {
  @ApiProperty({
    description: "Unique key for the metric",
    example: "api_calls",
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: "Display name",
    example: "API Calls",
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: "Description of what this metric measures",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Unit of measurement",
    example: "requests",
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: "How to aggregate this metric",
    enum: ["sum", "max", "count", "last"],
    default: "sum",
  })
  @IsOptional()
  @IsEnum(["sum", "max", "count", "last"])
  aggregation?: "sum" | "max" | "count" | "last";
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("usage")
@ApiSecurity("api-key")
@Controller("usage")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Post("events")
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Ingest usage event",
    description: `Record a single usage event for metering and billing.

**Use cases:**
- Track API calls, storage usage, message counts, etc.
- Usage-based billing (pay-as-you-go)
- Consumption quotas and limits

**Idempotency:** Use the \`idempotencyKey\` field to prevent duplicate events.
If a duplicate key is detected, the existing event ID is returned with \`deduplicated: true\`.

**Performance:** Events are ingested immediately; aggregates update asynchronously.`,
  })
  @ApiResponse({
    status: 201,
    description: "Event ingested successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        deduplicated: { type: "boolean" },
      },
    },
  })
  async ingestEvent(
    @WorkspaceId() workspaceId: string,
    @Body() dto: IngestEventDto,
  ) {
    return this.usageService.ingestEvent(workspaceId, {
      ...dto,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : undefined,
    });
  }

  @Post("events/batch")
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Ingest usage events in batch",
    description: `Record multiple usage events at once. Maximum 1000 events per batch.

**Use this for:**
- High-volume event ingestion
- Periodic batch uploads
- Efficient bulk recording`,
  })
  @ApiResponse({
    status: 201,
    description: "Batch ingested",
    schema: {
      type: "object",
      properties: {
        ingested: { type: "number", description: "New events created" },
        deduplicated: {
          type: "number",
          description: "Duplicate events skipped",
        },
      },
    },
  })
  async ingestBatch(
    @WorkspaceId() workspaceId: string,
    @Body() dto: IngestBatchDto,
  ) {
    return this.usageService.ingestBatch(
      workspaceId,
      dto.events.map((e) => ({
        ...e,
        timestamp: e.timestamp ? new Date(e.timestamp) : undefined,
      })),
    );
  }

  @Get("events")
  @MemberOnly()
  @ApiOperation({
    summary: "List usage events",
    description:
      "Retrieve usage events with optional filtering and pagination.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of usage events",
  })
  async listEvents(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryEventsDto,
  ) {
    return this.usageService.listEvents(workspaceId, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get("summary/:customerId/:metricKey")
  @MemberOnly()
  @ApiOperation({
    summary: "Get usage summary",
    description:
      "Get aggregated usage for a customer and metric within a period.",
  })
  @ApiParam({ name: "customerId", description: "Customer ID" })
  @ApiParam({ name: "metricKey", description: "Metric key" })
  @ApiResponse({
    status: 200,
    description: "Usage summary",
    schema: {
      type: "object",
      properties: {
        metricKey: { type: "string" },
        totalQuantity: { type: "number" },
        eventCount: { type: "number" },
        periodStart: { type: "string", format: "date-time" },
        periodEnd: { type: "string", format: "date-time" },
      },
    },
  })
  async getUsageSummary(
    @WorkspaceId() workspaceId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("metricKey") metricKey: string,
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
  ) {
    return this.usageService.getUsageSummary(
      workspaceId,
      customerId,
      metricKey,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  @Get("subscriptions/:subscriptionId/current/:metricKey")
  @MemberOnly()
  @ApiOperation({
    summary: "Get current period usage for subscription",
    description: "Get usage for the current billing period of a subscription.",
  })
  @ApiParam({ name: "subscriptionId", description: "Subscription ID" })
  @ApiParam({ name: "metricKey", description: "Metric key" })
  async getCurrentPeriodUsage(
    @WorkspaceId() workspaceId: string,
    @Param("subscriptionId", ParseUUIDPipe) subscriptionId: string,
    @Param("metricKey") metricKey: string,
  ) {
    return this.usageService.getCurrentPeriodUsage(
      workspaceId,
      subscriptionId,
      metricKey,
    );
  }

  @Post("metrics")
  @AdminOnly()
  @ApiOperation({
    summary: "Create usage metric",
    description: "Define a new billable metric for usage tracking.",
  })
  @ApiResponse({ status: 201, description: "Metric created" })
  async createMetric(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateMetricDto,
  ) {
    return this.usageService.createMetric(workspaceId, dto);
  }

  @Get("metrics")
  @MemberOnly()
  @ApiOperation({
    summary: "List usage metrics",
    description: "Get all defined usage metrics for the workspace.",
  })
  async listMetrics(@WorkspaceId() workspaceId: string) {
    return this.usageService.listMetrics(workspaceId);
  }
}
