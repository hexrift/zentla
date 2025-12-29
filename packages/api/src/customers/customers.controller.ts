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
import { CustomersService } from './customers.service';
import { WorkspaceId, AdminOnly, MemberOnly } from '../common/decorators';
import { IsString, IsEmail, IsOptional, IsInt, Min, Max, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateCustomerDto {
  @ApiProperty({ description: 'Customer email' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Customer name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'External ID for integration' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Customer name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'External ID for integration' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class QueryCustomersDto {
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
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;
}

@ApiTags('customers')
@ApiSecurity('api-key')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({ summary: 'List customers' })
  @ApiResponse({ status: 200, description: 'List of customers' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryCustomersDto
  ) {
    return this.customersService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      email: query.email,
      externalId: query.externalId,
    });
  }

  @Get(':id')
  @MemberOnly()
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const customer = await this.customersService.findById(workspaceId, id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCustomerDto
  ) {
    return this.customersService.create(workspaceId, dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update customer' })
  @ApiResponse({ status: 200, description: 'Customer updated' })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto
  ) {
    return this.customersService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer' })
  @ApiResponse({ status: 204, description: 'Customer deleted' })
  async delete(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.customersService.delete(workspaceId, id);
  }
}
