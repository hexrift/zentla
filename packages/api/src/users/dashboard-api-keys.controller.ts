import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeyService } from '../auth/services/api-key.service';
import { CurrentSession, type SessionContext } from '../common/decorators';
import { PrismaService } from '../database/prisma.service';
import type { ApiKeyRole, ApiKeyEnvironment, WorkspaceRole } from '@relay/database';

// ============================================================================
// REQUEST DTOs
// ============================================================================

class CreateDashboardApiKeyDto {
  @ApiProperty({
    description: 'Human-readable name to identify this API key',
    example: 'Production Backend Service',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Permission level for this API key',
    enum: ['owner', 'admin', 'member', 'readonly'],
    example: 'member',
  })
  @IsEnum(['owner', 'admin', 'member', 'readonly'])
  role!: ApiKeyRole;

  @ApiProperty({
    description: 'Environment this key operates in (test or live)',
    enum: ['live', 'test'],
    example: 'test',
  })
  @IsEnum(['live', 'test'])
  environment!: ApiKeyEnvironment;

  @ApiPropertyOptional({
    description: 'Optional expiration date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  role: string;
  environment: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface CreatedApiKey {
  id: string;
  secret: string;
  prefix: string;
  name: string;
  role: string;
  environment: string;
  message: string;
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 2,
  admin: 1,
};

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags('dashboard')
@ApiHeader({
  name: 'Authorization',
  description: 'Session token: Bearer relay_session_...',
})
@Controller('dashboard/workspaces/:workspaceId/api-keys')
export class DashboardApiKeysController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly prisma: PrismaService
  ) {}

  private async checkWorkspaceAccess(
    userId: string,
    workspaceId: string,
    requiredRole: WorkspaceRole = 'admin'
  ): Promise<WorkspaceRole> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const userLevel = ROLE_HIERARCHY[membership.role];
    const requiredLevel = ROLE_HIERARCHY[requiredRole];

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `This action requires ${requiredRole} role or higher`
      );
    }

    return membership.role;
  }

  @Get()
  @ApiOperation({
    summary: 'List API keys for workspace',
    description: 'Returns all active API keys for the specified workspace. Requires owner role.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async listApiKeys(
    @CurrentSession() session: SessionContext,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string
  ): Promise<ApiKeyListItem[]> {
    await this.checkWorkspaceAccess(session.userId, workspaceId, 'owner');

    const keys = await this.apiKeyService.listApiKeys(workspaceId);

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      role: key.role,
      environment: key.environment,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));
  }

  @Post()
  @ApiOperation({
    summary: 'Create API key',
    description: `Creates a new API key for the workspace. Requires owner role.

**Important:** The secret is only returned once in this response. Store it securely.`,
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or workspace not in live mode for live keys',
  })
  async createApiKey(
    @CurrentSession() session: SessionContext,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateDashboardApiKeyDto
  ): Promise<CreatedApiKey> {
    await this.checkWorkspaceAccess(session.userId, workspaceId, 'owner');

    // Check workspace mode for live key creation
    if (dto.environment === 'live') {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { mode: true },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      if (workspace.mode !== 'live') {
        throw new ForbiddenException(
          'Cannot create live API keys for workspaces in test mode. Request live mode access first.'
        );
      }
    }

    const result = await this.apiKeyService.generateApiKey(
      workspaceId,
      dto.name,
      dto.role,
      dto.environment,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined
    );

    return {
      id: result.id,
      secret: result.secret,
      prefix: result.prefix,
      name: dto.name,
      role: dto.role,
      environment: dto.environment,
      message: 'Store this secret securely. It will not be shown again.',
    };
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke API key',
    description: 'Permanently revokes an API key. Requires owner role.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'keyId',
    description: 'API key ID to revoke',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'API key revoked',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async revokeApiKey(
    @CurrentSession() session: SessionContext,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('keyId', ParseUUIDPipe) keyId: string
  ): Promise<void> {
    await this.checkWorkspaceAccess(session.userId, workspaceId, 'owner');
    await this.apiKeyService.revokeApiKey(workspaceId, keyId);
  }
}
