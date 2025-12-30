const API_BASE = '/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    pagination?: {
      hasMore: boolean;
      nextCursor?: string | null;
    };
  };
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = localStorage.getItem('relay_api_key') ?? '';

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  const json = await response.json() as ApiResponse<unknown>;

  // If response has pagination metadata, reconstruct the expected format
  if (json.meta?.pagination) {
    return {
      data: json.data,
      hasMore: json.meta.pagination.hasMore,
      nextCursor: json.meta.pagination.nextCursor ?? undefined,
    } as T;
  }

  // For non-paginated responses, return the data directly
  return json.data as T;
}

export const api = {
  offers: {
    list: (params?: { search?: string; status?: string; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/offers${query ? `?${query}` : ''}`
      );
    },
    get: (id: string) => fetchApi<Record<string, unknown>>(`/offers/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>('/offers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>(`/offers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    publish: (id: string, versionId?: string) =>
      fetchApi<Record<string, unknown>>(`/offers/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ versionId }),
      }),
    createVersion: (id: string, config: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>(`/offers/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ config }),
      }),
  },
  subscriptions: {
    list: (params?: { customerId?: string; status?: string; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.customerId) searchParams.set('customerId', params.customerId);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/subscriptions${query ? `?${query}` : ''}`
      );
    },
    get: (id: string) => fetchApi<Record<string, unknown>>(`/subscriptions/${id}`),
    cancel: (id: string, data: { cancelAtPeriodEnd?: boolean; reason?: string }) =>
      fetchApi<Record<string, unknown>>(`/subscriptions/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  customers: {
    list: (params?: { email?: string; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.email) searchParams.set('email', params.email);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/customers${query ? `?${query}` : ''}`
      );
    },
    get: (id: string) => fetchApi<Record<string, unknown>>(`/customers/${id}`),
    create: (data: { email: string; name?: string; externalId?: string }) =>
      fetchApi<Record<string, unknown>>('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getEntitlements: (customerId: string) =>
      fetchApi<Record<string, unknown>>(`/customers/${customerId}/entitlements`),
  },
  webhooks: {
    list: (params?: { limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/webhook-endpoints${query ? `?${query}` : ''}`
      );
    },
    create: (data: { url: string; events: string[]; description?: string }) =>
      fetchApi<Record<string, unknown>>('/webhook-endpoints', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/webhook-endpoints/${id}`, { method: 'DELETE' }),
  },
  apiKeys: {
    list: () => fetchApi<unknown[]>('/api-keys'),
    create: (data: { name: string; role: string; environment: string }) =>
      fetchApi<{ id: string; secret: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    revoke: (id: string) =>
      fetchApi<void>(`/api-keys/${id}`, { method: 'DELETE' }),
  },
  workspace: {
    get: () => fetchApi<Record<string, unknown>>('/workspaces/current'),
    update: (data: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>('/workspaces/current', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  promotions: {
    list: (params?: { search?: string; status?: string; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/promotions${query ? `?${query}` : ''}`
      );
    },
    get: (id: string) => fetchApi<Record<string, unknown>>(`/promotions/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>('/promotions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>(`/promotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    publish: (id: string, versionId?: string) =>
      fetchApi<Record<string, unknown>>(`/promotions/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ versionId }),
      }),
    createVersion: (id: string, config: Record<string, unknown>) =>
      fetchApi<Record<string, unknown>>(`/promotions/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ config }),
      }),
    archive: (id: string) =>
      fetchApi<Record<string, unknown>>(`/promotions/${id}/archive`, {
        method: 'POST',
      }),
    getUsage: (id: string) => fetchApi<Record<string, unknown>>(`/promotions/${id}/usage`),
  },
  events: {
    list: (params?: { status?: string; eventType?: string; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.eventType) searchParams.set('eventType', params.eventType);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/events${query ? `?${query}` : ''}`
      );
    },
    listDeadLetter: (params?: { limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/events/dead-letter${query ? `?${query}` : ''}`
      );
    },
  },
  auditLogs: {
    list: (params?: {
      actorType?: string;
      action?: string;
      resourceType?: string;
      limit?: number;
      cursor?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.actorType) searchParams.set('actorType', params.actorType);
      if (params?.action) searchParams.set('action', params.action);
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      const query = searchParams.toString();
      return fetchApi<{ data: unknown[]; hasMore: boolean; nextCursor?: string }>(
        `/audit-logs${query ? `?${query}` : ''}`
      );
    },
  },
};
