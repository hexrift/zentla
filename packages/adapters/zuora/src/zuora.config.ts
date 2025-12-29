export interface ZuoraConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  apiVersion?: string;
}

export function validateZuoraConfig(config: Partial<ZuoraConfig>): ZuoraConfig {
  if (!config.clientId) {
    throw new Error('Zuora client ID is required');
  }
  if (!config.clientSecret) {
    throw new Error('Zuora client secret is required');
  }
  if (!config.baseUrl) {
    throw new Error('Zuora base URL is required');
  }

  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    baseUrl: config.baseUrl,
    apiVersion: config.apiVersion ?? 'v1',
  };
}
