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
import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsBoolean, Matches } from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  @Matches(UUID_REGEX, { message: 'customerId must be a valid UUID' })
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'offerId must be a valid UUID' })
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
  @Matches(UUID_REGEX, { message: 'newOfferId must be a valid UUID' })
  newOfferId!: string;

  @ApiPropertyOptional({ description: 'New offer version ID' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'newOfferVersionId must be a valid UUID' })
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
  @ApiOperation({ summary: 'Change subscription plan (upgrade/downgrade)' })
  @ApiResponse({ status: 200, description: 'Subscription plan changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or subscription not changeable' })
  @ApiResponse({ status: 404, description: 'Subscription or offer not found' })
  async change(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionDto
  ) {
    return this.subscriptionsService.change(workspaceId, id, dto);
  }
}
