import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { ApiKeyContext } from "../../common/decorators";
import { PrismaService } from "../../database/prisma.service";
import type { ApiKey, ApiKeyRole, ApiKeyEnvironment } from "@relay/database";

const API_KEY_PREFIX_LIVE = "relay_live_";
const API_KEY_PREFIX_TEST = "relay_test_";
const API_KEY_LENGTH = 32;

export interface GeneratedApiKey {
  id: string;
  secret: string;
  prefix: string;
}

export interface ValidatedApiKey {
  id: string;
  workspaceId: string;
  role: ApiKeyRole;
  environment: ApiKeyEnvironment;
}

@Injectable()
export class ApiKeyService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const secret = this.config.get<string>("apiKey.secret");
    if (!secret) {
      throw new Error("API_KEY_SECRET is required");
    }
    this.secret = secret;
  }

  async generateApiKey(
    workspaceId: string,
    name: string,
    role: ApiKeyRole,
    environment: ApiKeyEnvironment,
    expiresAt?: Date,
  ): Promise<GeneratedApiKey> {
    const rawKey = randomBytes(API_KEY_LENGTH).toString("hex");
    const prefix =
      environment === "live" ? API_KEY_PREFIX_LIVE : API_KEY_PREFIX_TEST;
    const fullKey = `${prefix}${rawKey}`;
    const keyHash = this.hashApiKey(fullKey);
    const keyPrefix = fullKey.substring(0, prefix.length + 8);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        workspaceId,
        name,
        keyPrefix,
        keyHash,
        role,
        environment,
        expiresAt,
      },
    });

    return {
      id: apiKey.id,
      secret: fullKey,
      prefix: keyPrefix,
    };
  }

  async validateApiKey(apiKeyString: string): Promise<ValidatedApiKey | null> {
    const isLive = apiKeyString.startsWith(API_KEY_PREFIX_LIVE);
    const isTest = apiKeyString.startsWith(API_KEY_PREFIX_TEST);

    if (!isLive && !isTest) {
      return null;
    }

    const keyHash = this.hashApiKey(apiKeyString);
    const prefix = isLive ? API_KEY_PREFIX_LIVE : API_KEY_PREFIX_TEST;
    const keyPrefix = apiKeyString.substring(0, prefix.length + 8);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyPrefix,
        revokedAt: null,
      },
    });

    if (!apiKey) {
      return null;
    }

    // Timing-safe comparison
    const storedHash = Buffer.from(apiKey.keyHash, "hex");
    const providedHash = Buffer.from(keyHash, "hex");

    if (storedHash.length !== providedHash.length) {
      return null;
    }

    if (!timingSafeEqual(storedHash, providedHash)) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (fire and forget)
    this.updateLastUsed(apiKey.id).catch(() => {
      // Ignore errors
    });

    return {
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      role: apiKey.role,
      environment: apiKey.environment,
    };
  }

  async revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: {
        id: keyId,
        workspaceId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async listApiKeys(workspaceId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: {
        workspaceId,
        revokedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private hashApiKey(apiKey: string): string {
    return createHash("sha256")
      .update(apiKey)
      .update(this.secret)
      .digest("hex");
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  toApiKeyContext(validated: ValidatedApiKey): ApiKeyContext {
    return {
      keyId: validated.id,
      workspaceId: validated.workspaceId,
      role: validated.role as ApiKeyContext["role"],
      environment: validated.environment as ApiKeyContext["environment"],
    };
  }
}
