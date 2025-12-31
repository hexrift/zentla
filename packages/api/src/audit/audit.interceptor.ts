import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { AuditService } from "./audit.service";
import type { Request } from "express";
import type { ApiKeyContext, SessionContext } from "../common/decorators";

interface RequestWithAuth extends Request {
  apiKeyContext?: ApiKeyContext;
  sessionContext?: SessionContext;
}

// PII fields to anonymize
const PII_FIELDS = new Set([
  "email",
  "customerEmail",
  "name",
  "firstName",
  "lastName",
  "phone",
  "phoneNumber",
  "address",
  "street",
  "city",
  "postalCode",
  "zipCode",
  "ssn",
  "taxId",
  "cardNumber",
  "cvv",
  "password",
  "secret",
  "token",
]);

/**
 * Anonymize PII data in an object
 */
function anonymizePII(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(anonymizePII);
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (
        PII_FIELDS.has(key) ||
        key.toLowerCase().includes("email") ||
        key.toLowerCase().includes("password")
      ) {
        // Anonymize the value
        if (typeof value === "string") {
          if (key.toLowerCase().includes("email")) {
            // Mask email: john@example.com -> j***@e***.com
            const parts = value.split("@");
            if (parts.length === 2) {
              const [local, domain] = parts;
              const domainParts = domain.split(".");
              result[key] =
                `${local[0]}***@${domainParts[0][0]}***.${domainParts.slice(1).join(".")}`;
            } else {
              result[key] = "[REDACTED]";
            }
          } else if (key.toLowerCase().includes("name")) {
            // Mask name: John Doe -> J*** D***
            result[key] = value
              .split(" ")
              .map((part) => part[0] + "***")
              .join(" ");
          } else {
            result[key] = "[REDACTED]";
          }
        } else {
          result[key] = "[REDACTED]";
        }
      } else {
        result[key] = anonymizePII(value);
      }
    }
    return result;
  }

  return data;
}

// Map HTTP methods and paths to actions
function getActionFromRequest(method: string, path: string): string | null {
  // Skip GET requests (read-only) except for specific audit-worthy reads
  if (method === "GET") {
    // Log access to sensitive endpoints
    if (path.includes("/api-keys")) return "view_api_keys";
    if (path.includes("/audit-logs")) return "view_audit_logs";
    return null;
  }

  // Auth actions
  if (path.includes("/auth/signup")) return "signup";
  if (path.includes("/auth/login")) return "login";
  if (path.includes("/auth/logout") || path.includes("/auth/session")) {
    if (method === "DELETE") return "logout";
  }
  if (path.includes("/auth/github")) return "github_auth";

  // Extract resource from path (e.g., /api/v1/offers/123 -> offers)
  const pathParts = path.split("/").filter(Boolean);
  const apiIndex = pathParts.indexOf("api");
  const resourceIndex = apiIndex >= 0 ? apiIndex + 2 : 0;
  const resource = pathParts[resourceIndex]?.replace(/-/g, "_");

  if (!resource) return null;

  // Determine action based on method and path
  if (method === "POST") {
    if (path.includes("/publish")) return "publish";
    if (path.includes("/archive")) return "archive";
    if (path.includes("/cancel")) return "cancel";
    if (path.includes("/versions")) return "create_version";
    if (path.includes("/rotate-secret")) return "rotate_secret";
    if (path.includes("/checkout/sessions")) return "create_checkout_session";
    if (path.includes("/checkout/intents")) return "create_checkout_intent";
    if (path.includes("/checkout/quotes")) return "get_checkout_quote";
    if (path.includes("/validate")) return "validate";
    return "create";
  }
  if (method === "PATCH" || method === "PUT") return "update";
  if (method === "DELETE") return "delete";

  return null;
}

function getResourceTypeFromPath(path: string): string | null {
  // Handle auth endpoints specially
  if (path.includes("/auth/")) return "auth";

  const pathParts = path.split("/").filter(Boolean);
  const apiIndex = pathParts.indexOf("api");
  const resourceIndex = apiIndex >= 0 ? apiIndex + 2 : 0;
  const resource = pathParts[resourceIndex];

  if (!resource) return null;

  // Map plural endpoints to singular resource types
  const resourceMap: Record<string, string> = {
    offers: "offer",
    subscriptions: "subscription",
    customers: "customer",
    promotions: "promotion",
    "webhook-endpoints": "webhook_endpoint",
    "api-keys": "api_key",
    workspaces: "workspace",
    checkout: "checkout",
    sessions: "checkout_session",
    intents: "checkout_intent",
    quotes: "checkout_quote",
    dashboard: "dashboard",
    auth: "auth",
    "audit-logs": "audit_log",
  };

  return resourceMap[resource] ?? resource;
}

function getResourceIdFromPath(path: string): string | null {
  const pathParts = path.split("/").filter(Boolean);
  const apiIndex = pathParts.indexOf("api");
  const resourceIndex = apiIndex >= 0 ? apiIndex + 2 : 0;

  // Resource ID is typically the next part after the resource
  const potentialId = pathParts[resourceIndex + 1];

  // Check if it looks like a UUID
  if (potentialId && /^[0-9a-f-]{36}$/i.test(potentialId)) {
    return potentialId;
  }

  return null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const { method, path, ip, headers, body } = request;

    const action = getActionFromRequest(method, path);

    // Skip if no action to log (e.g., most GET requests)
    if (!action) {
      return next.handle();
    }

    const resourceType = getResourceTypeFromPath(path);
    const resourceIdFromPath = getResourceIdFromPath(path);
    const apiKeyContext = request.apiKeyContext;
    const sessionContext = request.sessionContext;

    // Determine actor type and ID
    let actorType: "api_key" | "user" | "system" = "api_key";
    let actorId = "unknown";
    let workspaceId: string | undefined;
    let environment: "test" | "live" = "test";

    if (sessionContext) {
      actorType = "user";
      actorId = sessionContext.userId;
      // For session auth, workspace comes from apiKeyContext (set by SessionGuard)
      workspaceId = apiKeyContext?.workspaceId;
      environment = (apiKeyContext?.environment as "test" | "live") ?? "test";
    } else if (apiKeyContext) {
      actorType = "api_key";
      actorId = apiKeyContext.keyId;
      workspaceId = apiKeyContext.workspaceId;
      environment = apiKeyContext.environment;
    }

    // For auth actions (signup/login), we may not have workspace context yet
    const isAuthAction = ["signup", "login", "github_auth", "logout"].includes(
      action,
    );

    // Skip if no workspace context and not an auth action
    if (!workspaceId && !isAuthAction) {
      return next.handle();
    }

    // Anonymize request body for logging
    const anonymizedBody = body ? anonymizePII(body) : undefined;

    // Helper to create audit log
    const createLog = (
      success: boolean,
      resourceId: string,
      errorMessage?: string,
    ) => {
      // For auth actions without workspace, use a placeholder
      const logWorkspaceId =
        workspaceId ?? "00000000-0000-0000-0000-000000000000";

      this.auditService
        .createAuditLog({
          workspaceId: logWorkspaceId,
          actorType,
          actorId,
          action: success ? action : `${action}_failed`,
          resourceType: resourceType ?? "unknown",
          resourceId: resourceId,
          changes: anonymizedBody as Record<string, unknown> | undefined,
          metadata: {
            method,
            path,
            environment,
            success,
            ...(errorMessage ? { error: errorMessage } : {}),
          },
          ipAddress: ip,
          userAgent: headers["user-agent"],
        })
        .catch(() => {
          // Silently ignore audit log failures
        });
    };

    return next.handle().pipe(
      tap({
        next: (response) => {
          // Extract resource ID from response if not in path
          let resourceId = resourceIdFromPath;
          if (!resourceId && response && typeof response === "object") {
            const data = (response as Record<string, unknown>).data as
              | Record<string, unknown>
              | undefined;
            resourceId =
              (data?.id as string) ??
              ((response as Record<string, unknown>).id as string) ??
              "unknown";
          }

          // For signup, try to get the new workspace ID from response
          if (action === "signup" && response && typeof response === "object") {
            const data = (response as Record<string, unknown>).data as
              | Record<string, unknown>
              | undefined;
            const workspaces = (data?.workspaces ??
              (response as Record<string, unknown>).workspaces) as
              | Array<{ id: string }>
              | undefined;
            if (workspaces?.[0]?.id) {
              resourceId = workspaces[0].id;
            }
          }

          // Log successful action
          createLog(true, resourceId ?? "unknown");
        },
      }),
      catchError((error) => {
        // Log failed action
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        createLog(false, resourceIdFromPath ?? "unknown", errorMessage);
        return throwError(() => error);
      }),
    );
  }
}
