import type {
  PortalCustomer,
  PortalSubscription,
  PortalInvoice,
  PortalEntitlement,
} from "./types";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1/portal`;

// Storage keys
const PORTAL_SESSION_TOKEN_KEY = "zentla_portal_session_token";
const PORTAL_WORKSPACE_ID_KEY = "zentla_portal_workspace_id";

// Get portal session token
export function getPortalSessionToken(): string | null {
  return localStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
}

// Set portal session token
export function setPortalSessionToken(token: string): void {
  localStorage.setItem(PORTAL_SESSION_TOKEN_KEY, token);
}

// Get workspace ID
export function getPortalWorkspaceId(): string | null {
  return localStorage.getItem(PORTAL_WORKSPACE_ID_KEY);
}

// Set workspace ID
export function setPortalWorkspaceId(workspaceId: string): void {
  localStorage.setItem(PORTAL_WORKSPACE_ID_KEY, workspaceId);
}

// Clear portal session
export function clearPortalSession(): void {
  localStorage.removeItem(PORTAL_SESSION_TOKEN_KEY);
  localStorage.removeItem(PORTAL_WORKSPACE_ID_KEY);
}

// Check if user is authenticated
export function isPortalAuthenticated(): boolean {
  return !!getPortalSessionToken() && !!getPortalWorkspaceId();
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// Fetch with portal auth
async function fetchPortal<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getPortalSessionToken();
  const workspaceId = getPortalWorkspaceId();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { "X-Portal-Token": token }),
      ...(workspaceId && { "X-Workspace-Id": workspaceId }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearPortalSession();
      window.location.href = "/portal/login";
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

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as ApiResponse<T>;
  return json.data as T;
}

// Public endpoint (no auth required)
async function fetchPublicPortal<T>(
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

  const json = (await response.json()) as ApiResponse<T>;
  return json.data as T;
}

export const portalApi = {
  // Authentication
  requestMagicLink: (
    email: string,
    workspaceId: string,
    portalBaseUrl: string,
  ) =>
    fetchPublicPortal<{ success: boolean }>("/request-magic-link", {
      method: "POST",
      body: JSON.stringify({ email, workspaceId, portalBaseUrl }),
    }),

  verifyMagicLink: (token: string, workspaceId: string) =>
    fetchPublicPortal<{ sessionToken: string; customer: PortalCustomer }>(
      "/verify",
      {
        method: "POST",
        body: JSON.stringify({ token, workspaceId }),
      },
    ),

  // Customer info
  getMe: () => fetchPortal<PortalCustomer>("/me"),

  logout: () => fetchPortal<void>("/logout", { method: "POST" }),

  // Subscriptions
  getSubscriptions: () => fetchPortal<PortalSubscription[]>("/subscriptions"),

  cancelSubscription: (subscriptionId: string) =>
    fetchPortal<PortalSubscription>(`/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
    }),

  reactivateSubscription: (subscriptionId: string) =>
    fetchPortal<PortalSubscription>(
      `/subscriptions/${subscriptionId}/reactivate`,
      {
        method: "POST",
      },
    ),

  // Invoices
  getInvoices: () => fetchPortal<PortalInvoice[]>("/invoices"),

  // Entitlements
  getEntitlements: () => fetchPortal<PortalEntitlement[]>("/entitlements"),

  // Billing portal
  createBillingPortalSession: (returnUrl: string) =>
    fetchPortal<{ url: string }>("/billing-portal", {
      method: "POST",
      body: JSON.stringify({ returnUrl }),
    }),
};
