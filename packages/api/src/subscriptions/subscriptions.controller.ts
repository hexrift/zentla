import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { WorkspaceId, AdminOnly, MemberOnly } from '../common/decorators';
import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class QuerySubscriptionsDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ enum: ['active', 'trialing', 'canceled', 'past_due', 'paused'] })
  @IsOptional()
  @IsString()
  status?: 'active' | 'trialing' | 'canceled' | 'past_due' | 'paused';
}

class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: 'Cancel at end of current period' })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}

class ChangeSubscriptionDto {
  @ApiProperty({ description: 'New offer ID' })
  @IsUUID()
  newOfferId!: string;

  @ApiPropertyOptional({ description: 'New offer version ID' })
  @IsOptional()
  @IsUUID()
  newOfferVersionId?: string;

  @ApiPropertyOptional({ enum: ['create_prorations', 'none', 'always_invoice'] })
  @IsOptional()
  @IsEnum(['create_prorations', 'none', 'always_invoice'])
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

@ApiTags('subscriptions')
@ApiSecurity('api-key')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({ summary: 'List subscriptions' })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QuerySubscriptionsDto
  ) {
    return this.subscriptionsService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      customerId: query.customerId,
      offerId: query.offerId,
      status: query.status,
    });
  }

  @Get(':id')
  @MemberOnly()
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const subscription = await this.subscriptionsService.findById(workspaceId, id);
    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return subscription;
  }

  @Post(':id/cancel')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled' })
  async cancel(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto
  ) {
    return this.subscriptionsService.cancel(workspaceId, id, dto);
  }

  @Post(':id/change')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change subscription plan' })
  @ApiResponse({ status: 200, description: 'Subscription changed' })
  async change(
    @WorkspaceId() _workspaceId: string,
    @Param('id', ParseUUIDPipe) _id: string,
    @Body() _dto: ChangeSubscriptionDto
  ) {
    // This would integrate with the billing provider
    // For now, return a not implemented error
    throw new Error('Subscription change requires billing provider integration');
  }
}
