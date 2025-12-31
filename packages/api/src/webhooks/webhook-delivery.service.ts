import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../database/prisma.service";
import { WebhooksService } from "./webhooks.service";
import { OutboxService } from "./outbox.service";
import type {
  WebhookEndpoint,
  WebhookEvent,
  OutboxEvent,
  Prisma,
} from "@prisma/client";

export interface WebhookDeliveryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: WebhookDeliveryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  timeoutMs: 30000, // 30 seconds
};

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly config: WebhookDeliveryConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
    private readonly outboxService: OutboxService,
  ) {
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Process pending outbox events and create webhook events for delivery
   * Runs every 10 seconds
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutbox(): Promise<void> {
    const pendingEvents = await this.outboxService.getPendingEvents(50);

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.debug(`Processing ${pendingEvents.length} outbox events`);

    for (const event of pendingEvents) {
      try {
        await this.fanOutEvent(event);
        await this.outboxService.markAsProcessed(event.id);
      } catch (error) {
        this.logger.error(`Failed to fan out event ${event.id}: ${error}`);
        // Don't mark as failed yet - will retry on next run
      }
    }
  }

  /**
   * Deliver pending webhook events with retry logic
   * Runs every 5 seconds
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async deliverPendingWebhooks(): Promise<void> {
    const now = new Date();

    // Find events that are pending and due for delivery/retry
    const events = await this.prisma.webhookEvent.findMany({
      where: {
        status: "pending",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      include: {
        endpoint: true,
      },
      take: 50,
      orderBy: { createdAt: "asc" },
    });

    if (events.length === 0) {
      return;
    }

    this.logger.debug(`Delivering ${events.length} webhook events`);

    // Process in parallel with concurrency limit
    const results = await Promise.allSettled(
      events.map((event) => this.deliverWebhook(event, event.endpoint)),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (succeeded > 0 || failed > 0) {
      this.logger.log(
        `Webhook delivery: ${succeeded} succeeded, ${failed} failed`,
      );
    }
  }

  /**
   * Fan out an outbox event to all matching webhook endpoints
   */
  private async fanOutEvent(event: OutboxEvent): Promise<void> {
    // Find all active endpoints subscribed to this event type
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        workspaceId: event.workspaceId,
        status: "active",
        events: { has: event.eventType },
      },
    });

    if (endpoints.length === 0) {
      this.logger.debug(`No endpoints subscribed to ${event.eventType}`);
      return;
    }

    // Create webhook events for each endpoint
    await this.prisma.webhookEvent.createMany({
      data: endpoints.map((endpoint) => ({
        workspaceId: event.workspaceId,
        endpointId: endpoint.id,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        status: "pending" as const,
        attempts: 0,
      })),
    });

    this.logger.debug(
      `Created ${endpoints.length} webhook events for ${event.eventType}`,
    );
  }

  /**
   * Attempt to deliver a webhook event
   */
  private async deliverWebhook(
    event: WebhookEvent,
    endpoint: WebhookEndpoint,
  ): Promise<void> {
    const payload = {
      id: event.id,
      type: event.eventType,
      timestamp: new Date().toISOString(),
      data: event.payload as Record<string, unknown>,
    };

    // Sign the payload
    const signature = this.webhooksService.signPayload(
      payload,
      endpoint.secret,
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Id": event.id,
          "X-Webhook-Timestamp": new Date().toISOString(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Success - mark as delivered
        await this.markDelivered(event.id, response.status, endpoint.id);
        this.logger.debug(`Delivered webhook ${event.id} to ${endpoint.url}`);
      } else {
        // HTTP error - schedule retry
        await this.handleDeliveryFailure(
          event,
          endpoint,
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }
    } catch (error) {
      // Network/timeout error - schedule retry
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.handleDeliveryFailure(event, endpoint, errorMessage);
    }
  }

  /**
   * Handle a failed delivery attempt
   */
  private async handleDeliveryFailure(
    event: WebhookEvent,
    endpoint: WebhookEndpoint,
    errorMessage: string,
  ): Promise<void> {
    const newAttempts = event.attempts + 1;

    if (newAttempts >= this.config.maxRetries) {
      // Max retries exceeded - move to dead letter queue
      await this.moveToDeadLetter(event, endpoint, errorMessage, newAttempts);
      return;
    }

    // Calculate next retry time with exponential backoff
    const delay = Math.min(
      this.config.initialDelayMs *
        Math.pow(this.config.backoffMultiplier, event.attempts),
      this.config.maxDelayMs,
    );
    const nextRetryAt = new Date(Date.now() + delay);

    await this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        attempts: newAttempts,
        lastAttemptAt: new Date(),
        nextRetryAt,
        response: { error: errorMessage } as Prisma.InputJsonValue,
      },
    });

    this.logger.warn(
      `Webhook ${event.id} failed (attempt ${newAttempts}/${this.config.maxRetries}): ${errorMessage}. Retry at ${nextRetryAt.toISOString()}`,
    );
  }

  /**
   * Mark a webhook event as successfully delivered
   */
  private async markDelivered(
    eventId: string,
    statusCode: number,
    endpointId: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "delivered",
          deliveredAt: now,
          response: { statusCode } as Prisma.InputJsonValue,
        },
      }),
      // Update endpoint delivery stats
      this.prisma.webhookEndpoint.update({
        where: { id: endpointId },
        data: {
          lastDeliveryAt: now,
          lastDeliveryStatus: statusCode,
          successCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Move a failed webhook to the dead letter queue
   */
  private async moveToDeadLetter(
    event: WebhookEvent,
    endpoint: WebhookEndpoint,
    failureReason: string,
    attempts: number,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      // Update webhook event status
      this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "failed",
          lastAttemptAt: now,
          response: { error: failureReason } as Prisma.InputJsonValue,
        },
      }),
      // Create dead letter entry
      this.prisma.deadLetterEvent.create({
        data: {
          workspaceId: event.workspaceId,
          originalEventId: event.id,
          endpointId: endpoint.id,
          eventType: event.eventType,
          payload: event.payload as Prisma.InputJsonValue,
          failureReason,
          attempts,
          lastAttemptAt: now,
        },
      }),
      // Update endpoint error stats
      this.prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastErrorAt: now,
          lastError: failureReason.substring(0, 1000), // Truncate to fit field
          failureCount: { increment: 1 },
        },
      }),
    ]);

    this.logger.error(
      `Webhook ${event.id} moved to dead letter queue after ${attempts} attempts: ${failureReason}`,
    );
  }

  /**
   * Manually trigger delivery of a specific webhook event (for testing)
   */
  async deliverSingleEvent(
    eventId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
      include: { endpoint: true },
    });

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    try {
      await this.deliverWebhook(event, event.endpoint);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Retry a dead letter event
   */
  async retryDeadLetterEvent(
    deadLetterId: string,
  ): Promise<{ success: boolean; newEventId?: string; error?: string }> {
    const deadLetter = await this.prisma.deadLetterEvent.findUnique({
      where: { id: deadLetterId },
      include: { endpoint: true },
    });

    if (!deadLetter) {
      return { success: false, error: "Dead letter event not found" };
    }

    if (deadLetter.endpoint.status !== "active") {
      return { success: false, error: "Endpoint is not active" };
    }

    // Create a new webhook event for retry
    const newEvent = await this.prisma.webhookEvent.create({
      data: {
        workspaceId: deadLetter.workspaceId,
        endpointId: deadLetter.endpointId,
        eventType: deadLetter.eventType,
        payload: deadLetter.payload as Prisma.InputJsonValue,
        status: "pending",
        attempts: 0,
      },
    });

    // Delete from dead letter queue
    await this.prisma.deadLetterEvent.delete({
      where: { id: deadLetterId },
    });

    this.logger.log(
      `Retrying dead letter ${deadLetterId} as new event ${newEvent.id}`,
    );

    return { success: true, newEventId: newEvent.id };
  }
}
