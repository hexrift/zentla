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
      .setDescription('Provider-agnostic subscription commerce orchestration platform')
      .setVersion('1.0')
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
      .addTag('offers', 'Offer and pricing management')
      .addTag('checkout', 'Checkout session management')
      .addTag('subscriptions', 'Subscription management')
      .addTag('customers', 'Customer management')
      .addTag('entitlements', 'Entitlement checks')
      .addTag('webhooks', 'Webhook management')
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
