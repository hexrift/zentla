import type {
  Offer,
  OfferVersion,
  Customer,
  Subscription,
  Checkout,
  WebhookEndpoint,
  EntitlementCheck,
  PaginatedResponse,
  CreateOfferInput,
  CreateCustomerInput,
  CreateCheckoutInput,
  CreateWebhookEndpointInput,
} from './types';

export interface RelayClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class RelayClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: RelayClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.relay.com/api/v1';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string; code?: string };
      throw new RelayError(
        error.message ?? `HTTP ${response.status}`,
        response.status,
        error.code
      );
    }

    const data = await response.json() as { data?: T } | T;
    return (data as { data?: T }).data ?? (data as T);
  }

  // Offers
  readonly offers = {
    list: (params?: {
      limit?: number;
      cursor?: string;
      status?: 'active' | 'archived';
    }): Promise<PaginatedResponse<Offer>> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.cursor) query.set('cursor', params.cursor);
      if (params?.status) query.set('status', params.status);
      return this.request('GET', `/offers?${query}`);
    },

    get: (id: string): Promise<Offer & { versions: OfferVersion[] }> =>
      this.request('GET', `/offers/${id}`),

    create: (input: CreateOfferInput): Promise<Offer> =>
      this.request('POST', '/offers', input),

    publish: (id: string, versionId?: string): Promise<OfferVersion> =>
      this.request('POST', `/offers/${id}/publish`, { versionId }),

    createVersion: (
      id: string,
      config: CreateOfferInput['config']
    ): Promise<OfferVersion> =>
      this.request('POST', `/offers/${id}/versions`, { config }),

    archive: (id: string): Promise<Offer> =>
      this.request('POST', `/offers/${id}/archive`),
  };

  // Customers
  readonly customers = {
    list: (params?: {
      limit?: number;
      cursor?: string;
      email?: string;
    }): Promise<PaginatedResponse<Customer>> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.cursor) query.set('cursor', params.cursor);
      if (params?.email) query.set('email', params.email);
      return this.request('GET', `/customers?${query}`);
    },

    get: (id: string): Promise<Customer> =>
      this.request('GET', `/customers/${id}`),

    create: (input: CreateCustomerInput): Promise<Customer> =>
      this.request('POST', '/customers', input),

    update: (
      id: string,
      input: Partial<CreateCustomerInput>
    ): Promise<Customer> => this.request('PATCH', `/customers/${id}`, input),

    getEntitlements: (id: string): Promise<{
      customerId: string;
      entitlements: EntitlementCheck[];
      activeSubscriptionIds: string[];
    }> => this.request('GET', `/customers/${id}/entitlements`),

    checkEntitlement: (
      id: string,
      featureKey: string
    ): Promise<EntitlementCheck> =>
      this.request('GET', `/customers/${id}/entitlements/check/${featureKey}`),
  };

  // Subscriptions
  readonly subscriptions = {
    list: (params?: {
      limit?: number;
      cursor?: string;
      customerId?: string;
      status?: string;
    }): Promise<PaginatedResponse<Subscription>> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.cursor) query.set('cursor', params.cursor);
      if (params?.customerId) query.set('customerId', params.customerId);
      if (params?.status) query.set('status', params.status);
      return this.request('GET', `/subscriptions?${query}`);
    },

    get: (id: string): Promise<Subscription> =>
      this.request('GET', `/subscriptions/${id}`),

    cancel: (
      id: string,
      params?: { cancelAtPeriodEnd?: boolean; reason?: string }
    ): Promise<Subscription> =>
      this.request('POST', `/subscriptions/${id}/cancel`, params),

    change: (
      id: string,
      params: {
        newOfferId: string;
        newOfferVersionId?: string;
        prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
      }
    ): Promise<Subscription> =>
      this.request('POST', `/subscriptions/${id}/change`, params),
  };

  // Checkout
  readonly checkout = {
    createSession: (input: CreateCheckoutInput): Promise<Checkout> =>
      this.request('POST', '/checkout/sessions', input),

    getSession: (id: string): Promise<Checkout> =>
      this.request('GET', `/checkout/sessions/${id}`),
  };

  // Webhook Endpoints
  readonly webhooks = {
    list: (params?: {
      limit?: number;
      cursor?: string;
    }): Promise<PaginatedResponse<WebhookEndpoint>> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.cursor) query.set('cursor', params.cursor);
      return this.request('GET', `/webhook-endpoints?${query}`);
    },

    create: (input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> =>
      this.request('POST', '/webhook-endpoints', input),

    update: (
      id: string,
      input: Partial<CreateWebhookEndpointInput>
    ): Promise<WebhookEndpoint> =>
      this.request('PATCH', `/webhook-endpoints/${id}`, input),

    delete: (id: string): Promise<void> =>
      this.request('DELETE', `/webhook-endpoints/${id}`),

    rotateSecret: (id: string): Promise<{ secret: string }> =>
      this.request('POST', `/webhook-endpoints/${id}/rotate-secret`),
  };
}

export class RelayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'RelayError';
  }
}
