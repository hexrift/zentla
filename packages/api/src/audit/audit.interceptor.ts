import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import type { Request } from 'express';
import type { ApiKeyContext } from '../common/decorators';

interface RequestWithApiKey extends Request {
  apiKeyContext?: ApiKeyContext;
}

// PII fields to anonymize
const PII_FIELDS = new Set([
  'email',
  'customerEmail',
  'name',
  'firstName',
  'lastName',
  'phone',
  'phoneNumber',
  'address',
  'street',
  'city',
  'postalCode',
  'zipCode',
  'ssn',
  'taxId',
  'cardNumber',
  'cvv',
  'password',
  'secret',
  'token',
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

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (PII_FIELDS.has(key) || key.toLowerCase().includes('email') || key.toLowerCase().includes('password')) {
        // Anonymize the value
        if (typeof value === 'string') {
          if (key.toLowerCase().includes('email')) {
            // Mask email: john@example.com -> j***@e***.com
            const parts = value.split('@');
            if (parts.length === 2) {
              const [local, domain] = parts;
              const domainParts = domain.split('.');
              result[key] = `${local[0]}***@${domainParts[0][0]}***.${domainParts.slice(1).join('.')}`;
            } else {
              result[key] = '[REDACTED]';
            }
          } else if (key.toLowerCase().includes('name')) {
            // Mask name: John Doe -> J*** D***
            result[key] = value.split(' ').map(part => part[0] + '***').join(' ');
          } else {
            result[key] = '[REDACTED]';
          }
        } else {
          result[key] = '[REDACTED]';
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
  // Skip GET requests (read-only)
  if (method === 'GET') return null;

  // Extract resource from path (e.g., /api/v1/offers/123 -> offers)
  const pathParts = path.split('/').filter(Boolean);
  const apiIndex = pathParts.indexOf('api');
  const resourceIndex = apiIndex >= 0 ? apiIndex + 2 : 0;
  const resource = pathParts[resourceIndex]?.replace(/-/g, '_');

  if (!resource) return null;

  // Determine action based on method and path
  if (method === 'POST') {
    if (path.includes('/publish')) return 'publish';
    if (path.includes('/archive')) return 'archive';
    if (path.includes('/cancel')) return 'cancel';
    if (path.includes('/versions')) return 'create_version';
    if (path.includes('/rotate-secret')) return 'rotate_secret';
    if (path.includes('/checkout/quotes')) return 'quote';
    if (path.includes('/checkout/intents')) return 'create_checkout';
    return 'create';
  }
  if (method === 'PATCH' || method === 'PUT') return 'update';
  if (method === 'DELETE') return 'delete';

  return null;
}

function getResourceTypeFromPath(path: string): string | null {
  const pathParts = path.split('/').filter(Boolean);
  const apiIndex = pathParts.indexOf('api');
  const resourceIndex = apiIndex >= 0 ? apiIndex + 2 : 0;
  const resource = pathParts[resourceIndex];

  if (!resource) return null;

  // Map plural endpoints to singular resource types
  const resourceMap: Record<string, string> = {
    offers: 'offer',
    subscriptions: 'subscription',
    customers: 'customer',
    promotions: 'promotion',
    'webhook-endpoints': 'webhook_endpoint',
    'api-keys': 'api_key',
    workspaces: 'workspace',
    checkout: 'checkout',
  };

  return resourceMap[resource] ?? resource;
}

function getResourceIdFromPath(path: string): string | null {
  const pathParts = path.split('/').filter(Boolean);
  const apiIndex = pathParts.indexOf('api');
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
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const { method, path, ip, headers, body } = request;

    const action = getActionFromRequest(method, path);

    // Skip if no action to log (e.g., GET requests)
    if (!action) {
      return next.handle();
    }

    const resourceType = getResourceTypeFromPath(path);
    const resourceIdFromPath = getResourceIdFromPath(path);
    const apiKeyContext = request.apiKeyContext;

    // Skip if no workspace context
    if (!apiKeyContext?.workspaceId) {
      return next.handle();
    }

    // Anonymize request body for logging
    const anonymizedBody = body ? anonymizePII(body) : undefined;

    return next.handle().pipe(
      tap({
        next: (response) => {
          // Extract resource ID from response if not in path
          let resourceId = resourceIdFromPath;
          if (!resourceId && response && typeof response === 'object') {
            const data = (response as Record<string, unknown>).data as Record<string, unknown> | undefined;
            resourceId = (data?.id as string) ?? (response as Record<string, unknown>).id as string ?? 'unknown';
          }

          // Log the action asynchronously (fire and forget)
          this.auditService
            .createAuditLog({
              workspaceId: apiKeyContext.workspaceId,
              actorType: 'api_key',
              actorId: apiKeyContext.keyId,
              action,
              resourceType: resourceType ?? 'unknown',
              resourceId: resourceId ?? 'unknown',
              changes: anonymizedBody as Record<string, unknown> | undefined,
              metadata: {
                method,
                path,
                environment: apiKeyContext.environment,
              },
              ipAddress: ip,
              userAgent: headers['user-agent'],
            })
            .catch(() => {
              // Silently ignore audit log failures
            });
        },
      })
    );
  }
}
