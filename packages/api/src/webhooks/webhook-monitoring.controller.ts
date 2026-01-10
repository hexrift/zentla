import {
  Controller,
  Get,
  Post,
  Param,
  Query,
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
  ApiPropertyOptional,
} from "@nestjs/swagger";
import { WebhookMonitoringService } from "./webhook-monitoring.service";
import { WorkspaceId, MemberOnly, AdminOnly } from "../common/decorators";
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from "class-validator";
import { Transform } from "class-transformer";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class GetStatsQueryDto {
  @ApiPropertyOptional({
    description: "Start date for stats period (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date for stats period (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

class GetEventsQueryDto {
  @IsOptional()
  @IsString()
  endpointId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

class GetDeadLetterQueryDto {
  @IsOptional()
  @IsString()
  endpointId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("webhook-monitoring")
@ApiSecurity("api-key")
@Controller("webhook-monitoring")
export class WebhookMonitoringController {
  constructor(private readonly monitoringService: WebhookMonitoringService) {}

  @Get("stats")
  @MemberOnly()
  @ApiOperation({
    summary: "Get webhook delivery statistics",
    description: `Returns overall webhook delivery statistics for your workspace.

**Metrics include:**
- Total delivered, failed, pending, and dead letter events
- Delivery success rate
- Average number of attempts for successful deliveries

**Default period:** Last 24 hours if no dates specified.`,
  })
  @ApiResponse({
    status: 200,
    description: "Webhook delivery statistics",
    schema: {
      type: "object",
      properties: {
        totalDelivered: { type: "number" },
        totalFailed: { type: "number" },
        totalPending: { type: "number" },
        totalDeadLetter: { type: "number" },
        deliveryRate: { type: "number", description: "Success rate percentage" },
        averageAttempts: { type: "number" },
      },
    },
  })
  async getStats(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetStatsQueryDto,
  ) {
    return this.monitoringService.getStats(
      workspaceId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get("endpoints/health")
  @MemberOnly()
  @ApiOperation({
    summary: "Get endpoint health status",
    description: `Returns health information for all webhook endpoints.

**Health status:**
- **healthy**: Delivery rate >= 95%
- **degraded**: Delivery rate >= 80% or recent errors
- **unhealthy**: Delivery rate < 80% or disabled`,
  })
  @ApiResponse({
    status: 200,
    description: "List of endpoint health data",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          status: { type: "string" },
          successCount: { type: "number" },
          failureCount: { type: "number" },
          deliveryRate: { type: "number" },
          lastDeliveryAt: { type: "string", nullable: true },
          lastDeliveryStatus: { type: "number", nullable: true },
          lastErrorAt: { type: "string", nullable: true },
          lastError: { type: "string", nullable: true },
          pendingEvents: { type: "number" },
          health: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
        },
      },
    },
  })
  async getEndpointHealth(@WorkspaceId() workspaceId: string) {
    return this.monitoringService.getEndpointHealth(workspaceId);
  }

  @Get("events")
  @MemberOnly()
  @ApiOperation({
    summary: "Get recent webhook events",
    description: `Returns recent webhook events with delivery status.

**Filterable by:**
- Endpoint ID
- Status (pending, delivered, failed, dead_letter)`,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of webhook events",
  })
  async getRecentEvents(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetEventsQueryDto,
  ) {
    return this.monitoringService.getRecentEvents(workspaceId, {
      endpointId: query.endpointId,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get("dead-letter")
  @MemberOnly()
  @ApiOperation({
    summary: "Get dead letter events",
    description: `Returns events that have exhausted all retry attempts.

Dead letter events can be manually retried to requeue them for delivery.`,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of dead letter events",
  })
  async getDeadLetterEvents(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetDeadLetterQueryDto,
  ) {
    return this.monitoringService.getDeadLetterEvents(workspaceId, {
      endpointId: query.endpointId,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Post("dead-letter/:id/retry")
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Retry a dead letter event",
    description: `Requeues a dead letter event for delivery.

Creates a new webhook event with pending status and removes the event from the dead letter queue.`,
  })
  @ApiParam({
    name: "id",
    description: "Dead letter event ID",
  })
  @ApiResponse({
    status: 200,
    description: "Event requeued",
    schema: {
      type: "object",
      properties: {
        webhookEventId: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Dead letter event not found" })
  async retryDeadLetterEvent(
    @WorkspaceId() workspaceId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.monitoringService.retryDeadLetterEvent(workspaceId, id);
  }

  @Get("event-types")
  @MemberOnly()
  @ApiOperation({
    summary: "Get event type breakdown",
    description: `Returns delivery statistics grouped by event type.

**Default period:** Last 7 days if no dates specified.`,
  })
  @ApiResponse({
    status: 200,
    description: "Event type breakdown",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          eventType: { type: "string" },
          count: { type: "number" },
          deliveryRate: { type: "number" },
        },
      },
    },
  })
  async getEventTypeBreakdown(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetStatsQueryDto,
  ) {
    return this.monitoringService.getEventTypeBreakdown(
      workspaceId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }
}
