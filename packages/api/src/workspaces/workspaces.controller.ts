import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceId, OwnerOnly } from '../common/decorators';
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Workspace name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['stripe', 'zuora'] })
  @IsOptional()
  @IsEnum(['stripe', 'zuora'])
  defaultProvider?: 'stripe' | 'zuora';

  @ApiPropertyOptional({ description: 'Workspace settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

@ApiTags('workspaces')
@ApiSecurity('api-key')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current workspace' })
  @ApiResponse({ status: 200, description: 'Current workspace details' })
  async getCurrent(@WorkspaceId() workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Patch('current')
  @OwnerOnly()
  @ApiOperation({ summary: 'Update current workspace' })
  @ApiResponse({ status: 200, description: 'Workspace updated' })
  async updateCurrent(
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateWorkspaceDto
  ) {
    return this.workspacesService.update(workspaceId, dto);
  }

  @Delete('current')
  @OwnerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current workspace' })
  @ApiResponse({ status: 204, description: 'Workspace deleted' })
  async deleteCurrent(@WorkspaceId() workspaceId: string) {
    await this.workspacesService.delete(workspaceId);
  }
}
