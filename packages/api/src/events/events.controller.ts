import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ApiKeyContext, CurrentApiKey } from '../common/decorators';
import { EventsService } from './events.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List events', description: 'List outbox events for the workspace' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'processed', 'failed'] })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'aggregateType', required: false, type: String })
  @ApiQuery({ name: 'aggregateId', required: false, type: String })
  async listEvents(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: 'pending' | 'processed' | 'failed',
    @Query('eventType') eventType?: string,
    @Query('aggregateType') aggregateType?: string,
    @Query('aggregateId') aggregateId?: string,
  ) {
    const result = await this.eventsService.listEvents(apiKey.workspaceId, {
      limit: limit ? parseInt(limit, 10) : 50,
      cursor,
      status,
      eventType,
      aggregateType,
      aggregateId,
    });

    return {
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
      },
    };
  }

  @Get('dead-letter')
  @ApiOperation({ summary: 'List dead letter events', description: 'List failed webhook deliveries' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async listDeadLetterEvents(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const result = await this.eventsService.listDeadLetterEvents(apiKey.workspaceId, {
      limit: limit ? parseInt(limit, 10) : 50,
      cursor,
    });

    return {
      success: true,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
      },
    };
  }
}
