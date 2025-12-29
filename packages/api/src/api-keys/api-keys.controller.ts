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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyService } from '../auth/services/api-key.service';
import { WorkspaceId, OwnerOnly } from '../common/decorators';
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateApiKeyDto {
  @ApiProperty({ description: 'API key name' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['owner', 'admin', 'member', 'readonly'] })
  @IsEnum(['owner', 'admin', 'member', 'readonly'])
  role!: 'owner' | 'admin' | 'member' | 'readonly';

  @ApiProperty({ enum: ['live', 'test'] })
  @IsEnum(['live', 'test'])
  environment!: 'live' | 'test';

  @ApiPropertyOptional({ description: 'Expiration date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@ApiTags('api-keys')
@ApiSecurity('api-key')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @OwnerOnly()
  @ApiOperation({ summary: 'List API keys' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  async findAll(@WorkspaceId() workspaceId: string) {
    const keys = await this.apiKeyService.listApiKeys(workspaceId);
    // Don't expose the hash, just return safe fields
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
  @OwnerOnly()
  @ApiOperation({ summary: 'Create API key' })
  @ApiResponse({ status: 201, description: 'API key created (secret shown once)' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateApiKeyDto
  ) {
    const result = await this.apiKeyService.generateApiKey(
      workspaceId,
      dto.name,
      dto.role,
      dto.environment,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined
    );

    return {
      id: result.id,
      secret: result.secret, // Only shown once!
      prefix: result.prefix,
      message: 'Store this secret securely. It will not be shown again.',
    };
  }

  @Delete(':id')
  @OwnerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiResponse({ status: 204, description: 'API key revoked' })
  async revoke(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.apiKeyService.revokeApiKey(workspaceId, id);
  }
}
