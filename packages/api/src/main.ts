import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggerService } from './common/logger/logger.service';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
    bufferLogs: true,
  });

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Security - configure CSP to allow Scalar docs in development
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production'
        ? undefined // Use default strict CSP in production
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            },
          },
    })
  );
  app.enableCors({
    origin: nodeEnv === 'production'
      ? configService.get<string>('CORS_ORIGIN', 'https://app.relay.com')
      : true,
    credentials: true,
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // Strict typing - no implicit conversions
      },
    })
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI/Swagger with Scalar UI
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Relay API')
      .setDescription(`# Provider-Agnostic Subscription Commerce Platform

Relay is a **provider-agnostic** subscription commerce orchestration platform. It provides a unified API layer for managing subscriptions, customers, entitlements, and checkouts across different billing providers.

## Architecture

Relay abstracts billing provider complexity behind a clean API:

| Component | Description |
|-----------|-------------|
| **Relay API** | This unified interface for your application |
| **Adapters** | Provider-specific implementations (Stripe, Zuora, etc.) |
| **Provider Refs** | Mapping between Relay entities and external provider IDs |

## Supported Providers

| Provider | Status | Adapter |
|----------|--------|---------|
| **Stripe** | Production Ready | \`@relay/adapters-stripe\` |
| **Zuora** | Planned | \`@relay/adapters-zuora\` |

## Authentication

All API requests require authentication via API key in the Authorization header:

\`\`\`
Authorization: Bearer relay_live_xxx
\`\`\`

API keys come in two environments:
- \`relay_live_xxx\` - Production API keys
- \`relay_test_xxx\` - Test/sandbox API keys

## Rate Limiting

| Limit Type | Requests | Window |
|------------|----------|--------|
| Burst | 10 | per second |
| Short-term | 50 | per 10 seconds |
| Standard | 100 | per minute |

When rate limited, responses include headers:
- \`X-RateLimit-Limit\`: Request limit
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets

## Concurrency Control

Mutable resources (customers, subscriptions, offers) support optimistic locking via ETags:

1. \`GET\` responses include an \`ETag\` header
2. Include \`If-Match: <etag>\` on \`PATCH\`/\`PUT\` requests
3. \`412 Precondition Failed\` if the resource was modified

## Idempotency

For \`POST\` requests, include an \`Idempotency-Key\` header:

\`\`\`
Idempotency-Key: unique-request-id-123
\`\`\`

Duplicate requests with the same key within 24 hours return the cached response.

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Customer not found",
    "details": { "id": "..." }
  },
  "meta": {
    "requestId": "abc-123",
    "timestamp": "2025-01-15T10:30:00Z",
    "path": "/api/v1/customers/..."
  }
}
\`\`\`

Use \`error.code\` for programmatic error handling.
`)
      .setVersion('1.0')
      .addServer('http://localhost:3000', 'Local Development')
      .addServer('https://api.staging.relay.example.com', 'Staging')
      .addServer('https://api.relay.example.com', 'Production')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'API Key with format: Bearer relay_live_xxx or Bearer relay_test_xxx',
        },
        'api-key'
      )
      .addTag('workspaces', 'Workspace management')
      .addTag('offers', 'Offer and pricing management with versioning')
      .addTag('promotions', 'Discount codes and promotional offers')
      .addTag('checkout', 'Checkout session management')
      .addTag('subscriptions', 'Subscription lifecycle management')
      .addTag('customers', 'Customer management with Stripe/Zuora sync')
      .addTag('entitlements', 'Feature access checks')
      .addTag('webhooks', 'Inbound provider webhooks and outbound event delivery')
      .addTag('api-keys', 'API key management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // Serve raw OpenAPI JSON (useful for SDK generation)
    app.use('/openapi.json', (_req: unknown, res: { json: (doc: unknown) => void }) => {
      res.json(document);
    });

    // Scalar API Reference - beautiful Stripe-like documentation
    app.use(
      '/docs',
      apiReference({
        content: document,
        theme: 'purple',
        layout: 'modern',
        darkMode: true,
        metaData: {
          title: 'Relay API Documentation',
          description: 'Provider-agnostic subscription commerce orchestration platform',
        },
      })
    );
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Relay API running on port ${port} in ${nodeEnv} mode`, 'Bootstrap');

  if (nodeEnv !== 'production') {
    logger.log(`API docs (Scalar) available at http://localhost:${port}/docs`, 'Bootstrap');
    logger.log(`OpenAPI spec available at http://localhost:${port}/openapi.json`, 'Bootstrap');
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start Relay API:', error);
  process.exit(1);
});
