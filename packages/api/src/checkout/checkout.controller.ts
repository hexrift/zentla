import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { WorkspaceId, MemberOnly } from '../common/decorators';
import { IsOptional, Matches, IsUrl, IsBoolean, IsInt, Min, Max, IsEmail, IsObject } from 'class-validator';

// UUID regex that accepts any UUID-formatted string (including non-RFC4122 compliant)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'Offer ID' })
  @Matches(UUID_REGEX, { message: 'offerId must be a valid UUID' })
  offerId!: string;

  @ApiPropertyOptional({ description: 'Specific offer version ID' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'offerVersionId must be a valid UUID' })
  offerVersionId?: string;

  @ApiPropertyOptional({ description: 'Existing customer ID' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'customerId must be a valid UUID' })
  customerId?: string;

  @ApiPropertyOptional({ description: 'Customer email for new customers' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ description: 'URL to redirect on success' })
  @IsUrl()
  successUrl!: string;

  @ApiProperty({ description: 'URL to redirect on cancel' })
  @IsUrl()
  cancelUrl!: string;

  @ApiPropertyOptional({ description: 'Allow promotion codes' })
  @IsOptional()
  @IsBoolean()
  allowPromotionCodes?: boolean;

  @ApiPropertyOptional({ description: 'Trial period in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@ApiTags('checkout')
@ApiSecurity('api-key')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('sessions')
  @MemberOnly()
  @ApiOperation({ summary: 'Create a checkout session' })
  @ApiResponse({ status: 201, description: 'Checkout session created with redirect URL' })
  async createSession(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCheckoutSessionDto
  ) {
    const session = await this.checkoutService.create(workspaceId, dto);

    return {
      id: session.id,
      url: session.url,
      expiresAt: session.expiresAt,
    };
  }

  @Get('sessions/:id')
  @MemberOnly()
  @ApiOperation({ summary: 'Get checkout session status' })
  @ApiResponse({ status: 200, description: 'Checkout session details' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const checkout = await this.checkoutService.findById(workspaceId, id);
    if (!checkout) {
      throw new NotFoundException(`Checkout session ${id} not found`);
    }
    return checkout;
  }
}
