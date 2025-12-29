export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  secret: string;
  events: string[];
  status: WebhookEndpointStatus;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEndpointStatus = 'active' | 'disabled';

export interface WebhookEvent {
  id: string;
  workspaceId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  response?: WebhookResponse;
  createdAt: Date;
}

export type WebhookEventStatus = 'pending' | 'delivered' | 'failed' | 'dead_letter';

export interface WebhookResponse {
  statusCode: number;
  body?: string;
  headers?: Record<string, string>;
  durationMs: number;
}

export interface OutboxEvent {
  id: string;
  workspaceId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  processedAt?: Date;
  createdAt: Date;
}

export type OutboxEventStatus = 'pending' | 'processed' | 'failed';

export interface DeadLetterEvent {
  id: string;
  workspaceId: string;
  originalEventId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  attempts: number;
  lastAttemptAt: Date;
  createdAt: Date;
}
