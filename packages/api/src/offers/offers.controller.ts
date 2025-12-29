import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { WorkspaceId, AdminOnly, MemberOnly } from '../common/decorators';
import { CreateOfferRequestDto, CreateVersionRequestDto, QueryOffersDto, PublishOfferDto, RollbackOfferDto, UpdateOfferDto } from './dto';

@ApiTags('offers')
@ApiSecurity('api-key')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @MemberOnly()
  @ApiOperation({ summary: 'List offers' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'archived'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of offers' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryOffersDto
  ) {
    return this.offersService.findMany(workspaceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      status: query.status,
      search: query.search,
    });
  }

  @Get(':id')
  @MemberOnly()
  @ApiOperation({ summary: 'Get offer by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Offer details with versions' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const offer = await this.offersService.findById(workspaceId, id);
    if (!offer) {
      throw new Error('Offer not found');
    }
    return offer;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new offer' })
  @ApiResponse({ status: 201, description: 'Offer created' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateOfferRequestDto
  ) {
    return this.offersService.create(workspaceId, dto);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update offer metadata' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Offer updated' })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto
  ) {
    return this.offersService.update(workspaceId, id, dto);
  }

  @Post(':id/archive')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive an offer' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Offer archived' })
  async archive(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.offersService.archive(workspaceId, id);
  }

  @Get(':id/versions')
  @MemberOnly()
  @ApiOperation({ summary: 'List offer versions' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'List of versions' })
  async getVersions(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.offersService.getVersions(workspaceId, id);
  }

  @Post(':id/versions')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new draft version' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Version created' })
  async createVersion(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionRequestDto
  ) {
    return this.offersService.createVersion(workspaceId, id, dto.config);
  }

  @Post(':id/publish')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft version' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Version published' })
  async publish(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishOfferDto
  ) {
    return this.offersService.publishVersion(workspaceId, id, dto.versionId);
  }

  @Post(':id/rollback')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create new draft from a previous version' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Rollback version created' })
  async rollback(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RollbackOfferDto
  ) {
    return this.offersService.rollbackToVersion(workspaceId, id, dto.targetVersionId);
  }
}
