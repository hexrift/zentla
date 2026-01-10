import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  portalApi,
  clearPortalSession,
  isPortalAuthenticated,
} from "../../lib/portal-api";
import type {
  PortalSubscription,
  PortalInvoice,
  PortalEntitlement,
} from "../../lib/types";

type TabType = "subscriptions" | "invoices" | "entitlements";

export function PortalDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("subscriptions");
  const isAuthenticated = isPortalAuthenticated();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/portal/login");
    }
  }, [isAuthenticated, navigate]);

  // Fetch customer info
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ["portal-customer"],
    queryFn: () => portalApi.getMe(),
    enabled: isAuthenticated,
  });

  // Fetch subscriptions
  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["portal-subscriptions"],
    queryFn: () => portalApi.getSubscriptions(),
    enabled: isAuthenticated,
  });

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["portal-invoices"],
    queryFn: () => portalApi.getInvoices(),
    enabled: isAuthenticated && activeTab === "invoices",
  });

  // Fetch entitlements
  const { data: entitlements, isLoading: entitlementsLoading } = useQuery({
    queryKey: ["portal-entitlements"],
    queryFn: () => portalApi.getEntitlements(),
    enabled: isAuthenticated && activeTab === "entitlements",
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: (subscriptionId: string) =>
      portalApi.cancelSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-subscriptions"] });
    },
  });

  // Reactivate subscription mutation
  const reactivateMutation = useMutation({
    mutationFn: (subscriptionId: string) =>
      portalApi.reactivateSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-subscriptions"] });
    },
  });

  // Billing portal mutation
  const billingPortalMutation = useMutation({
    mutationFn: () =>
      portalApi.createBillingPortalSession(window.location.href),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await portalApi.logout();
    } catch {
      // Ignore errors
    }
    clearPortalSession();
    navigate("/portal/login");
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      trialing: "bg-blue-100 text-blue-800",
      canceled: "bg-gray-100 text-gray-800",
      suspended: "bg-red-100 text-red-800",
      paid: "bg-green-100 text-green-800",
      open: "bg-yellow-100 text-yellow-800",
      void: "bg-gray-100 text-gray-800",
      uncollectible: "bg-red-100 text-red-800",
    };
    return styles[status] ?? "bg-gray-100 text-gray-800";
  };

  if (customerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Customer Portal
              </h1>
              <p className="text-sm text-gray-500">{customer?.email}</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => billingPortalMutation.mutate()}
                disabled={billingPortalMutation.isPending}
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                {billingPortalMutation.isPending
                  ? "Loading..."
                  : "Manage Payment Method"}
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("subscriptions")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "subscriptions"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => setActiveTab("invoices")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "invoices"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab("entitlements")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "entitlements"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Features
            </button>
          </nav>
        </div>

        {/* Subscriptions Tab */}
        {activeTab === "subscriptions" && (
          <div className="space-y-4">
            {subscriptionsLoading ? (
              <div className="text-gray-500">Loading...</div>
            ) : !subscriptions || subscriptions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">No active subscriptions</p>
              </div>
            ) : (
              subscriptions.map((sub: PortalSubscription) => (
                <div key={sub.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {sub.offer.name}
                      </h3>
                      <div className="mt-1 flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(
                            sub.status,
                          )}`}
                        >
                          {sub.status}
                        </span>
                        {sub.cancelAt && (
                          <span className="text-xs text-yellow-600">
                            Cancels {formatDate(sub.currentPeriodEnd)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {sub.status === "active" && (
                        <>
                          {sub.cancelAt ? (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Reactivate your subscription? It will continue after the current period ends.",
                                  )
                                ) {
                                  reactivateMutation.mutate(sub.id);
                                }
                              }}
                              disabled={reactivateMutation.isPending}
                              className="text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
                            >
                              {reactivateMutation.isPending
                                ? "..."
                                : "Keep subscription"}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Cancel your subscription? You'll have access until the end of your billing period.",
                                  )
                                ) {
                                  cancelMutation.mutate(sub.id);
                                }
                              }}
                              disabled={cancelMutation.isPending}
                              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {cancelMutation.isPending
                                ? "..."
                                : "Cancel subscription"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Current period</span>
                        <p className="text-gray-900">
                          {formatDate(sub.currentPeriodStart)} -{" "}
                          {formatDate(sub.currentPeriodEnd)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Started</span>
                        <p className="text-gray-900">
                          {formatDate(sub.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoicesLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : !invoices || invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No invoices yet
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice: PortalInvoice) => (
                    <tr key={invoice.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(
                            invoice.status,
                          )}`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.providerInvoiceUrl ? (
                          <a
                            href={invoice.providerInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-800"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Entitlements Tab */}
        {activeTab === "entitlements" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Your Features
              </h3>
              <p className="text-sm text-gray-500">
                Features available with your current subscription
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {entitlementsLoading ? (
                <div className="px-6 py-4 text-center text-gray-500">
                  Loading...
                </div>
              ) : !entitlements || entitlements.length === 0 ? (
                <div className="px-6 py-4 text-center text-gray-500">
                  No features configured
                </div>
              ) : (
                entitlements.map((ent: PortalEntitlement) => (
                  <div
                    key={ent.featureKey}
                    className="px-6 py-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {ent.featureKey}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {ent.valueType === "boolean" ? (
                        ent.value ? (
                          <span className="text-green-600">Enabled</span>
                        ) : (
                          <span className="text-gray-400">Disabled</span>
                        )
                      ) : (
                        <span>{String(ent.value)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
