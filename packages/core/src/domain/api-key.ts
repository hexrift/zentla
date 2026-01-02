export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  role: ApiKeyRole;
  environment: ApiKeyEnvironment;
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiKeyRole = "owner" | "admin" | "member" | "readonly";

export type ApiKeyEnvironment = "live" | "test";

export interface ApiKeyWithSecret extends ApiKey {
  secret: string;
}

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  role: ApiKeyRole;
  environment: ApiKeyEnvironment;
}

export const API_KEY_PREFIXES = {
  live: "zentla_live_",
  test: "zentla_test_",
} as const;
