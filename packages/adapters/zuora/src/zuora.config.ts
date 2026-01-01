export interface ZuoraConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookSecret?: string;
  apiVersion?: string;
}

export function validateZuoraConfig(config: Partial<ZuoraConfig>): ZuoraConfig {
  if (!config.clientId) {
    throw new Error("Zuora client ID is required");
  }
  if (!config.clientSecret) {
    throw new Error("Zuora client secret is required");
  }
  if (!config.baseUrl) {
    throw new Error("Zuora base URL is required");
  }

  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    baseUrl: config.baseUrl.replace(/\/$/, ""), // Remove trailing slash
    webhookSecret: config.webhookSecret,
    apiVersion: config.apiVersion ?? "v1",
  };
}

// Standard Zuora environments
export const ZUORA_ENVIRONMENTS = {
  production: "https://rest.zuora.com",
  sandbox: "https://rest.apisandbox.zuora.com",
  services: "https://rest.zuora.com",
  servicesSandbox: "https://rest.apisandbox.zuora.com",
  eu: "https://rest.eu.zuora.com",
  euSandbox: "https://rest.sandbox.eu.zuora.com",
} as const;
