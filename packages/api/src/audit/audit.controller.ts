import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import { WorkspaceId, MemberOnly } from "../common/decorators";
import { AuditService } from "./audit.service";
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from "class-validator";
import { Transform } from "class-transformer";

// ============================================================================
// REQUEST DTOs
// ============================================================================

enum ActorType {
  API_KEY = "api_key",
  USER = "user",
  SYSTEM = "system",
  WEBHOOK = "webhook",
}

class QueryAuditLogsDto {
  @ApiPropertyOptional({
    description: "Maximum number of audit logs to return per page.",
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
    description: "Filter by actor type.",
    enum: ActorType,
  })
  @IsOptional()
  @IsEnum(ActorType)
  actorType?: ActorType;

  @ApiPropertyOptional({
    description: "Filter by actor ID (e.g., API key ID or user ID).",
  })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({
    description:
      "Filter by action (e.g., 'create', 'update', 'delete', 'publish').",
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description:
      "Filter by resource type (e.g., 'customer', 'offer', 'subscription').",
  })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({
    description: "Filter by resource ID.",
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({
    description: "Filter logs created on or after this date (ISO 8601 format).",
    example: "2025-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "Filter logs created on or before this date (ISO 8601 format).",
    example: "2025-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("Audit Logs")
@ApiSecurity("api-key")
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({
    summary: "List audit logs",
    description: `Retrieves a paginated list of audit log entries for your workspace.

**Use this to:**
- Track changes made to resources
- Monitor API key usage
- Debug issues and investigate incidents
- Build audit trail reports

**Filters:** Filter by actor, action, resource, or date range.`,
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of audit log entries",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async listAuditLogs(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryAuditLogsDto,
  ) {
    return this.auditService.listAuditLogs(workspaceId, {
      limit: query.limit ?? 50,
      cursor: query.cursor,
      actorType: query.actorType,
      actorId: query.actorId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }
}
