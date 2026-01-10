import * as Joi from "joi";

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  apiKey: {
    secret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    publishableKey: string;
  };
  webhook: {
    signingSecret: string;
  };
  rateLimit: {
    ttl: number;
    max: number;
  };
  cors: {
    origin: string;
  };
  logging: {
    level: string;
  };
  email: {
    resendApiKey: string;
    defaultFromEmail: string;
    defaultFromName: string;
  };
}

export const configuration = (): AppConfig => ({
  port: parseInt(process.env.PORT ?? "3000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  apiKey: {
    secret: process.env.API_KEY_SECRET ?? "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  },
  webhook: {
    signingSecret: process.env.WEBHOOK_SIGNING_SECRET ?? "",
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? "60", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? "*",
  },
  logging: {
    level: process.env.LOG_LEVEL ?? "debug",
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    defaultFromEmail: process.env.EMAIL_DEFAULT_FROM ?? "billing@example.com",
    defaultFromName: process.env.EMAIL_DEFAULT_FROM_NAME ?? "Billing Team",
  },
});

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default("redis://localhost:6379"),
  API_KEY_SECRET: Joi.string().min(32).required(),
  STRIPE_SECRET_KEY: Joi.string().allow("").optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow("").optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow("").optional(),
  WEBHOOK_SIGNING_SECRET: Joi.string().min(32).required(),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),
  CORS_ORIGIN: Joi.string().default("*"),
  LOG_LEVEL: Joi.string()
    .valid("debug", "info", "warn", "error")
    .default("debug"),
  RESEND_API_KEY: Joi.string().allow("").optional(),
  EMAIL_DEFAULT_FROM: Joi.string().email().default("billing@example.com"),
  EMAIL_DEFAULT_FROM_NAME: Joi.string().default("Billing Team"),
});
