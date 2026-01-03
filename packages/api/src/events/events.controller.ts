import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import { WorkspaceId, MemberOnly } from "../common/decorators";
import { EventsService } from "./events.service";
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from "class-validator";
import { Transform } from "class-transformer";

// ============================================================================
// REQUEST DTOs
// ============================================================================

export enum EventStatus {
  PENDING = "pending",
  PROCESSED = "processed",
  FAILED = "failed",
}

class QueryEventsDto {
  @ApiPropertyOptional({
    description: "Maximum number of events to return per page.",
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      "Pagination cursor from a previous response. Pass `nextCursor` from the last response to fetch the next page.",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: "Filter by event status.",
    enum: EventStatus,
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({
    description:
      "Filter by event type (e.g., 'subscription.created', 'invoice.paid').",
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({
    description:
      "Filter by aggregate type (e.g., 'subscription', 'customer', 'invoice').",
  })
  @IsOptional()
  @IsString()
  aggregateType?: string;

  @ApiPropertyOptional({
    description: "Filter by aggregate ID.",
  })
  @IsOptional()
  @IsString()
  aggregateId?: string;
}

class QueryDeadLetterDto {
  @ApiPropertyOptional({
    description: "Maximum number of dead letter events to return per page.",
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      "Pagination cursor from a previous response. Pass `nextCursor` from the last response to fetch the next page.",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("Events")
@ApiSecurity("api-key")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: "List events",
    description: `Retrieves a paginated list of outbox events for your workspace.

**Use this to:**
- Monitor webhook delivery status
- Debug event processing issues
- Build event monitoring dashboards

**Filters:** Filter by status, event type, or aggregate.`,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of events",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async listEvents(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryEventsDto,
  ) {
    return this.eventsService.listEvents(workspaceId, {
      limit: query.limit ?? 50,
      cursor: query.cursor,
      status: query.status,
      eventType: query.eventType,
      aggregateType: query.aggregateType,
      aggregateId: query.aggregateId,
    });
  }

  @Get("dead-letter")
  @MemberOnly()
  @ApiOperation({
    summary: "List dead letter events",
    description: `Retrieves a paginated list of failed webhook deliveries.

**Use this to:**
- Monitor failed webhook deliveries
- Investigate delivery failures
- Retry failed events`,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of dead letter events",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async listDeadLetterEvents(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryDeadLetterDto,
  ) {
    return this.eventsService.listDeadLetterEvents(workspaceId, {
      limit: query.limit ?? 50,
      cursor: query.cursor,
    });
  }
}
