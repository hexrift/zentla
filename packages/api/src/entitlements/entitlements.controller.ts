import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { EntitlementsService } from './entitlements.service';
import { WorkspaceId, MemberOnly } from '../common/decorators';
import { IsString, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CheckEntitlementsDto {
  @ApiProperty({ description: 'Feature keys to check', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  featureKeys!: string[];
}

@ApiTags('entitlements')
@ApiSecurity('api-key')
@Controller('customers/:customerId/entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({ summary: 'Get all entitlements for a customer' })
  @ApiResponse({ status: 200, description: 'Customer entitlements' })
  async getCustomerEntitlements(
    @WorkspaceId() workspaceId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string
  ) {
    return this.entitlementsService.getCustomerEntitlements(workspaceId, customerId);
  }

  @Get('check/:featureKey')
  @MemberOnly()
  @ApiOperation({ summary: 'Check a single entitlement' })
  @ApiResponse({ status: 200, description: 'Entitlement check result' })
  async checkSingleEntitlement(
    @WorkspaceId() workspaceId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('featureKey') featureKey: string
  ) {
    return this.entitlementsService.checkEntitlement(workspaceId, customerId, featureKey);
  }

  @Post('check')
  @MemberOnly()
  @ApiOperation({ summary: 'Check multiple entitlements' })
  @ApiResponse({ status: 200, description: 'Multiple entitlement check results' })
  async checkMultipleEntitlements(
    @WorkspaceId() workspaceId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CheckEntitlementsDto
  ) {
    return this.entitlementsService.checkMultipleEntitlements(
      workspaceId,
      customerId,
      dto.featureKeys
    );
  }
}
