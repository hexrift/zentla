export interface AuditLog {
  id: string;
  workspaceId: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: AuditChanges;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type ActorType = "api_key" | "user" | "system" | "webhook";

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: Record<string, { from: unknown; to: unknown }>;
}

export interface CreateAuditLogInput {
  workspaceId: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: AuditChanges;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "archive"
  | "rollback"
  | "cancel"
  | "revoke";
