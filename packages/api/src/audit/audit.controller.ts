import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ApiKeyContext, CurrentApiKey } from "../common/decorators";
import { AuditService } from "./audit.service";

@ApiTags("Audit Logs")
@ApiBearerAuth()
@Controller({ path: "audit-logs", version: "1" })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: "List audit logs",
    description: "List audit log entries for the workspace",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({
    name: "actorType",
    required: false,
    enum: ["api_key", "user", "system", "webhook"],
  })
  @ApiQuery({ name: "actorId", required: false, type: String })
  @ApiQuery({ name: "action", required: false, type: String })
  @ApiQuery({ name: "resourceType", required: false, type: String })
  @ApiQuery({ name: "resourceId", required: false, type: String })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "ISO 8601 date",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "ISO 8601 date",
  })
  async listAuditLogs(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @Query("actorType") actorType?: "api_key" | "user" | "system" | "webhook",
    @Query("actorId") actorId?: string,
    @Query("action") action?: string,
    @Query("resourceType") resourceType?: string,
    @Query("resourceId") resourceId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const result = await this.auditService.listAuditLogs(apiKey.workspaceId, {
      limit: limit ? parseInt(limit, 10) : 50,
      cursor,
      actorType,
      actorId,
      action,
      resourceType,
      resourceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return {
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
      },
    };
  }
}
