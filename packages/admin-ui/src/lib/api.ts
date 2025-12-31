import type {
  Offer,
  Subscription,
  Customer,
  WebhookEndpoint,
  Promotion,
  CheckoutSession,
  CheckoutIntent,
  Event,
  DeadLetterEvent,
  AuditLog,
  ApiKey,
  Workspace,
  PaginatedResponse,
  AuthResponse,
  AuthUser,
  AuthWorkspace,
} from "./types";

const API_BASE = "/api/v1";

// Storage keys
const SESSION_TOKEN_KEY = "relay_session_token";
const CURRENT_WORKSPACE_KEY = "relay_current_workspace";

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

// Get session token for auth
export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

// Set session token
export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

// Clear session token
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(CURRENT_WORKSPACE_KEY);
}

// Get current workspace
export function getCurrentWorkspace(): string | null {
  return localStorage.getItem(CURRENT_WORKSPACE_KEY);
}

// Set current workspace
export function setCurrentWorkspace(workspaceId: string): void {
  localStorage.setItem(CURRENT_WORKSPACE_KEY, workspaceId);
}

// Fetch with session auth (for dashboard endpoints)
async function fetchWithSession<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getSessionToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSessionToken();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    const errorBody = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    const errorMessage =
      errorBody.error?.message ??
      errorBody.message ??
      `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  const json = (await response.json()) as ApiResponse<T>;
  return json.data as T;
}

// Fetch without auth (for public endpoints like login/signup)
async function fetchPublic<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    const errorMessage =
      errorBody.error?.message ??
      errorBody.message ??
      `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  // Unwrap the response data
  const json = (await response.json()) as ApiResponse<T>;
  return json.data as T;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Prefer session token, fall back to API key for backwards compatibility
  const sessionToken = getSessionToken();
  const apiKey = localStorage.getItem("relay_api_key") ?? "";
  const token = sessionToken || apiKey;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && sessionToken) {
      clearSessionToken();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    const errorBody = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    // Handle both old format (message) and new format (error.message)
    const errorMessage =
      errorBody.error?.message ??
      errorBody.message ??
      `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  const json = (await response.json()) as ApiResponse<T>;

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
    list: (params?: {
      search?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Offer>>(
        `/offers${query ? `?${query}` : ""}`,
      );
    },
    get: (id: string) => fetchApi<Offer>(`/offers/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi<Offer>("/offers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi<Offer>(`/offers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    publish: (id: string, versionId?: string) =>
      fetchApi<Offer>(`/offers/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      }),
    createVersion: (id: string, config: Record<string, unknown>) =>
      fetchApi<Offer>(`/offers/${id}/versions`, {
        method: "POST",
        body: JSON.stringify({ config }),
      }),
    updateDraft: (id: string, config: Record<string, unknown>) =>
      fetchApi<Offer>(`/offers/${id}/versions/draft`, {
        method: "PATCH",
        body: JSON.stringify({ config }),
      }),
    archive: (id: string) =>
      fetchApi<Offer>(`/offers/${id}/archive`, {
        method: "POST",
      }),
    sync: (id: string) =>
      fetchApi<{ success: boolean; message: string }>(`/offers/${id}/sync`, {
        method: "POST",
      }),
  },
  subscriptions: {
    list: (params?: {
      customerId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.customerId) searchParams.set("customerId", params.customerId);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Subscription>>(
        `/subscriptions${query ? `?${query}` : ""}`,
      );
    },
    get: (id: string) => fetchApi<Subscription>(`/subscriptions/${id}`),
    cancel: (
      id: string,
      data: { cancelAtPeriodEnd?: boolean; reason?: string },
    ) =>
      fetchApi<Subscription>(`/subscriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  customers: {
    list: (params?: { email?: string; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.email) searchParams.set("email", params.email);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Customer>>(
        `/customers${query ? `?${query}` : ""}`,
      );
    },
    get: (id: string) => fetchApi<Customer>(`/customers/${id}`),
    create: (data: { email: string; name?: string; externalId?: string }) =>
      fetchApi<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getEntitlements: (customerId: string) =>
      fetchApi<{
        customerId: string;
        entitlements: Array<{
          featureKey: string;
          hasAccess: boolean;
          value: unknown;
        }>;
      }>(`/customers/${customerId}/entitlements`),
  },
  webhooks: {
    list: (params?: { limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<WebhookEndpoint>>(
        `/webhook-endpoints${query ? `?${query}` : ""}`,
      );
    },
    create: (data: { url: string; events: string[]; description?: string }) =>
      fetchApi<WebhookEndpoint>("/webhook-endpoints", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/webhook-endpoints/${id}`, { method: "DELETE" }),
  },
  apiKeys: {
    list: () => fetchApi<ApiKey[]>("/api-keys"),
    create: (data: { name: string; role: string; environment: string }) =>
      fetchApi<{ id: string; secret: string }>("/api-keys", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    revoke: (id: string) =>
      fetchApi<void>(`/api-keys/${id}`, { method: "DELETE" }),
  },
  workspace: {
    get: () => fetchApi<Workspace>("/workspaces/current"),
    update: (data: Record<string, unknown>) =>
      fetchApi<Workspace>("/workspaces/current", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },
  promotions: {
    list: (params?: {
      search?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Promotion>>(
        `/promotions${query ? `?${query}` : ""}`,
      );
    },
    get: (id: string) => fetchApi<Promotion>(`/promotions/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi<Promotion>("/promotions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi<Promotion>(`/promotions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    publish: (id: string, versionId?: string) =>
      fetchApi<Promotion>(`/promotions/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      }),
    createVersion: (id: string, config: Record<string, unknown>) =>
      fetchApi<Promotion>(`/promotions/${id}/versions`, {
        method: "POST",
        body: JSON.stringify({ config }),
      }),
    archive: (id: string) =>
      fetchApi<Promotion>(`/promotions/${id}/archive`, {
        method: "POST",
      }),
    getUsage: (id: string) =>
      fetchApi<{ redemptionCount: number; totalDiscount: number }>(
        `/promotions/${id}/usage`,
      ),
  },
  events: {
    list: (params?: {
      status?: string;
      eventType?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.eventType) searchParams.set("eventType", params.eventType);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Event>>(
        `/events${query ? `?${query}` : ""}`,
      );
    },
    listDeadLetter: (params?: { limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<DeadLetterEvent>>(
        `/events/dead-letter${query ? `?${query}` : ""}`,
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
      if (params?.actorType) searchParams.set("actorType", params.actorType);
      if (params?.action) searchParams.set("action", params.action);
      if (params?.resourceType)
        searchParams.set("resourceType", params.resourceType);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      if (params?.startDate) searchParams.set("startDate", params.startDate);
      if (params?.endDate) searchParams.set("endDate", params.endDate);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<AuditLog>>(
        `/audit-logs${query ? `?${query}` : ""}`,
      );
    },
  },
  checkout: {
    listSessions: (params?: {
      status?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<CheckoutSession>>(
        `/checkout/sessions${query ? `?${query}` : ""}`,
      );
    },
    listIntents: (params?: {
      status?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<CheckoutIntent>>(
        `/checkout/intents${query ? `?${query}` : ""}`,
      );
    },
    getStats: () =>
      fetchApi<{
        sessions: {
          total: number;
          pending: number;
          completed: number;
          expired: number;
          conversionRate: number;
        };
        intents: {
          total: number;
          pending: number;
          processing: number;
          requiresAction: number;
          succeeded: number;
          failed: number;
          expired: number;
          conversionRate: number;
        };
      }>("/checkout/stats"),
    createSession: (data: {
      offerId: string;
      successUrl: string;
      cancelUrl: string;
      customerId?: string;
      customerEmail?: string;
      promotionCode?: string;
      metadata?: Record<string, string>;
    }) =>
      fetchApi<{ id: string; url: string; expiresAt: string }>(
        "/checkout/sessions",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
  },

  // Auth endpoints (public, no token required)
  auth: {
    signup: (data: { email: string; password: string; name?: string }) =>
      fetchPublic<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      fetchPublic<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getGitHubUrl: () => fetchPublic<{ url: string }>("/auth/github"),
    githubCallback: (code: string) =>
      fetchPublic<AuthResponse>("/auth/github/callback", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    me: () =>
      fetchWithSession<{ user: AuthUser; workspaces: AuthWorkspace[] }>(
        "/auth/me",
      ),
    logout: () => fetchWithSession<void>("/auth/session", { method: "DELETE" }),
  },

  // Dashboard endpoints (session auth)
  dashboard: {
    apiKeys: {
      list: (workspaceId: string) =>
        fetchWithSession<
          Array<{
            id: string;
            name: string;
            keyPrefix: string;
            role: string;
            environment: string;
            lastUsedAt: string | null;
            expiresAt: string | null;
            createdAt: string;
          }>
        >(`/dashboard/workspaces/${workspaceId}/api-keys`),
      create: (
        workspaceId: string,
        data: {
          name: string;
          role: string;
          environment: string;
          expiresAt?: string;
        },
      ) =>
        fetchWithSession<{
          id: string;
          secret: string;
          prefix: string;
          name: string;
          role: string;
          environment: string;
          message: string;
        }>(`/dashboard/workspaces/${workspaceId}/api-keys`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      revoke: (workspaceId: string, keyId: string) =>
        fetchWithSession<void>(
          `/dashboard/workspaces/${workspaceId}/api-keys/${keyId}`,
          {
            method: "DELETE",
          },
        ),
    },
  },
};
