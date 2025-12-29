import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WorkspaceId, AdminOnly, MemberOnly } from '../common/decorators';
import { IsString, IsOptional, IsArray, ArrayMinSize, IsEnum, IsInt, Min, Max, IsUrl, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateWebhookEndpointDto {
  @ApiProperty({ description: 'Webhook URL' })
  @IsUrl()
  url!: string;

  @ApiProperty({ description: 'Events to subscribe to', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateWebhookEndpointDto {
  @ApiPropertyOptional({ description: 'Webhook URL' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Events to subscribe to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional()
  @IsEnum(['active', 'disabled'])
  status?: 'active' | 'disabled';

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class QueryEndpointsDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}

@ApiTags('webhooks')
@ApiSecurity('api-key')
@Controller('webhook-endpoints')
export class WebhookEndpointsController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({ summary: 'List webhook endpoints' })
  @ApiResponse({ status: 200, description: 'List of webhook endpoints' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryEndpointsDto
  ) {
    return this.webhooksService.findEndpoints(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  @MemberOnly()
  @ApiOperation({ summary: 'Get webhook endpoint by ID' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint details' })
  @ApiResponse({ status: 404, description: 'Endpoint not found' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const endpoint = await this.webhooksService.findEndpointById(workspaceId, id);
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }
    return endpoint;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create webhook endpoint' })
  @ApiResponse({ status: 201, description: 'Webhook endpoint created' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateWebhookEndpointDto
  ) {
    return this.webhooksService.createEndpoint(workspaceId, dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint updated' })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookEndpointDto
  ) {
    return this.webhooksService.updateEndpoint(workspaceId, id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  @ApiResponse({ status: 204, description: 'Webhook endpoint deleted' })
  async delete(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.webhooksService.deleteEndpoint(workspaceId, id);
  }

  @Post(':id/rotate-secret')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate webhook secret' })
  @ApiResponse({ status: 200, description: 'New secret generated' })
  async rotateSecret(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const newSecret = await this.webhooksService.rotateSecret(workspaceId, id);
    return { secret: newSecret };
  }
}
