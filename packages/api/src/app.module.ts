import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";

// Infrastructure modules
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { LoggerModule } from "./common/logger/logger.module";
import { BillingModule } from "./billing/billing.module";

// Feature modules
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { UsersModule } from "./users/users.module";
import { OffersModule } from "./offers/offers.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { CustomersModule } from "./customers/customers.module";
import { EntitlementsModule } from "./entitlements/entitlements.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { HealthModule } from "./health/health.module";
import { EventsModule } from "./events/events.module";
import { AuditModule } from "./audit/audit.module";
import { FeedbackModule } from "./feedback/feedback.module";

// Guards
import { ApiKeyGuard } from "./auth/guards/api-key.guard";
import { ThrottlerGuard } from "@nestjs/throttler";
import { WorkspaceGuard } from "./auth/guards/workspace.guard";
import { SessionGuard } from "./users/session.guard";

// Interceptors
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { AuditInterceptor } from "./audit/audit.interceptor";

// Middleware
import { IdempotencyMiddleware } from "./common/middleware/idempotency.middleware";

// Configuration
import { configuration, validationSchema } from "./config/configuration";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 10,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 50,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Infrastructure
    LoggerModule,
    DatabaseModule,
    AuthModule,
    BillingModule,

    // Features
    HealthModule,
    WorkspacesModule,
    UsersModule,
    OffersModule,
    PromotionsModule,
    CheckoutModule,
    SubscriptionsModule,
    CustomersModule,
    EntitlementsModule,
    WebhooksModule,
    ApiKeysModule,
    EventsModule,
    AuditModule,
    FeedbackModule,
  ],
  providers: [
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Global guards (order matters)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: WorkspaceGuard,
    },
    // Middleware as provider for DI
    IdempotencyMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdempotencyMiddleware).forRoutes("*");
  }
}
