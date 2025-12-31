import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggerService } from "./common/logger/logger.service";
import { ALL_MODELS } from "./common/models";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
    bufferLogs: true,
  });

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  // Security - configure CSP to allow Scalar docs in development
  app.use(
    helmet({
      contentSecurityPolicy:
        nodeEnv === "production"
          ? undefined // Use default strict CSP in production
          : {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  "https://cdn.jsdelivr.net",
                ],
                styleSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  "https://cdn.jsdelivr.net",
                  "https://fonts.googleapis.com",
                ],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
              },
            },
    }),
  );
  app.enableCors({
    origin:
      nodeEnv === "production"
        ? configService.get<string>("CORS_ORIGIN", "https://app.relay.com")
        : true,
    credentials: true,
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "v",
  });

  // Global prefix
  app.setGlobalPrefix("api");

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // Strict typing - no implicit conversions
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI/Swagger with Scalar UI
  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Relay API")
      .setDescription(
        `# Relay API

Relay manages subscriptions, customers, entitlements, and checkouts. It connects your application to billing providers like Stripe, handling the complexity so you don't have to.

## Quick Start

1. Create an **Offer** with pricing and entitlements
2. Generate a **Checkout** link for customers
3. Customers subscribe → Relay creates the **Subscription** and grants **Entitlements**
4. Query entitlements to control feature access in your app

## Authentication

Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer relay_live_xxx
\`\`\`

- \`relay_live_xxx\` - Production
- \`relay_test_xxx\` - Test/sandbox (uses Stripe test mode)

## Metadata

Attach custom metadata to offers, checkouts, and subscriptions for tracking campaigns, attribution, or internal references:

\`\`\`json
{
  "metadata": {
    "campaign": "summer_2025",
    "channel": "website",
    "source": "google",
    "internal_ref": "deal-123"
  }
}
\`\`\`

Metadata flows through: **Offer → Checkout → Subscription → Webhook Events**

## Rate Limits

| Limit | Requests | Window |
|-------|----------|--------|
| Burst | 10 | /second |
| Short | 50 | /10 seconds |
| Standard | 100 | /minute |

Rate limit headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Concurrency (ETags)

Mutable resources support optimistic locking:
1. \`GET\` → \`ETag\` header
2. \`PATCH\` with \`If-Match: <etag>\`
3. \`412 Precondition Failed\` if modified

## Idempotency

For \`POST\` requests, include:
\`\`\`
Idempotency-Key: unique-request-id-123
\`\`\`

## Error Format

\`\`\`json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Customer not found",
    "details": { "id": "..." }
  }
}
\`\`\`

Use \`error.code\` for programmatic handling.
`,
      )
      .setVersion("1.0")
      .addServer("http://localhost:3000", "Local Development")
      .addApiKey(
        {
          type: "apiKey",
          name: "Authorization",
          in: "header",
          description:
            "API Key with format: Bearer relay_live_xxx or Bearer relay_test_xxx",
        },
        "api-key",
      )
      .addTag("workspaces", "Workspace management")
      .addTag("offers", "Offer and pricing management with versioning")
      .addTag("promotions", "Discount codes and promotional offers")
      .addTag("checkout", "Checkout session management")
      .addTag("subscriptions", "Subscription lifecycle management")
      .addTag("customers", "Customer management with Stripe/Zuora sync")
      .addTag("entitlements", "Feature access checks")
      .addTag(
        "webhooks",
        "Inbound provider webhooks and outbound event delivery",
      )
      .addTag("api-keys", "API key management")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      extraModels: ALL_MODELS,
    });

    // Remove DTO schemas from Models section - keep only domain models
    // DTOs are still used inline for request/response validation
    const domainModels = new Set([
      "ApiKey",
      "CheckoutSession",
      "Customer",
      "Entitlement",
      "Offer",
      "OfferVersion",
      "Promotion",
      "Subscription",
      "WebhookEndpoint",
      "WebhookEvent",
    ]);

    if (document.components?.schemas) {
      const schemas = document.components.schemas as Record<string, unknown>;
      for (const schemaName of Object.keys(schemas)) {
        if (!domainModels.has(schemaName)) {
          delete schemas[schemaName];
        }
      }
    }

    // Serve raw OpenAPI JSON (useful for SDK generation)
    app.use(
      "/openapi.json",
      (_req: unknown, res: { json: (doc: unknown) => void }) => {
        res.json(document);
      },
    );

    // Scalar API Reference - beautiful Stripe-like documentation
    app.use(
      "/docs",
      apiReference({
        content: document,
        theme: "purple",
        layout: "modern",
        darkMode: true,
        metaData: {
          title: "Relay API Documentation",
          description:
            "Subscription management API for offers, customers, and entitlements",
        },
      }),
    );
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(
    `Relay API running on port ${port} in ${nodeEnv} mode`,
    "Bootstrap",
  );

  if (nodeEnv !== "production") {
    logger.log(
      `API docs (Scalar) available at http://localhost:${port}/docs`,
      "Bootstrap",
    );
    logger.log(
      `OpenAPI spec available at http://localhost:${port}/openapi.json`,
      "Bootstrap",
    );
  }
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start Relay API:", error);
  process.exit(1);
});
