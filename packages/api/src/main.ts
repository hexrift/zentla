import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

  // Security
  app.use(helmet());
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

  // OpenAPI/Swagger
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
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Relay API running on port ${port} in ${nodeEnv} mode`, 'Bootstrap');

  if (nodeEnv !== 'production') {
    logger.log(`API docs available at http://localhost:${port}/docs`, 'Bootstrap');
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start Relay API:', error);
  process.exit(1);
});
