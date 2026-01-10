import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  WebhookEndpoint,
  WebhookEventSummary,
  WebhookDeadLetterSummary,
  EndpointHealth,
} from "../lib/types";

const AVAILABLE_EVENTS = [
  {
    value: "subscription.created",
    label: "Subscription Created",
    description: "New subscription started",
  },
  {
    value: "subscription.updated",
    label: "Subscription Updated",
    description: "Plan change, status update",
  },
  {
    value: "subscription.canceled",
    label: "Subscription Canceled",
    description: "Subscription canceled",
  },
  {
    value: "checkout.completed",
    label: "Checkout Completed",
    description: "Checkout session completed",
  },
  {
    value: "invoice.paid",
    label: "Invoice Paid",
    description: "Payment succeeded",
  },
  {
    value: "invoice.payment_failed",
    label: "Invoice Payment Failed",
    description: "Payment failed",
  },
  {
    value: "customer.created",
    label: "Customer Created",
    description: "New customer",
  },
  {
    value: "customer.updated",
    label: "Customer Updated",
    description: "Customer details modified",
  },
];

interface CreateFormData {
  url: string;
  events: string[];
  description: string;
}

type TabType = "endpoints" | "monitoring" | "dead-letter";

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("endpoints");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateFormData>({
    url: "",
    events: [],
    description: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Endpoints query
  const { data, isLoading, error } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => api.webhooks.list(),
  });

  // Monitoring queries
  const { data: stats } = useQuery({
    queryKey: ["webhook-stats"],
    queryFn: () => api.webhooks.getStats(),
    enabled: activeTab === "monitoring",
  });

  const { data: endpointHealth } = useQuery({
    queryKey: ["webhook-endpoint-health"],
    queryFn: () => api.webhooks.getEndpointHealth(),
    enabled: activeTab === "monitoring",
  });

  const { data: recentEvents } = useQuery({
    queryKey: ["webhook-recent-events", statusFilter],
    queryFn: () =>
      api.webhooks.getRecentEvents({
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: 20,
      }),
    enabled: activeTab === "monitoring",
  });

  const { data: eventTypeBreakdown } = useQuery({
    queryKey: ["webhook-event-breakdown"],
    queryFn: () => api.webhooks.getEventTypeBreakdown(),
    enabled: activeTab === "monitoring",
  });

  const { data: deadLetterEvents } = useQuery({
    queryKey: ["webhook-dead-letter"],
    queryFn: () => api.webhooks.getDeadLetterEvents({ limit: 20 }),
    enabled: activeTab === "dead-letter",
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      url: string;
      events: string[];
      description?: string;
    }) => api.webhooks.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setCreatedSecret(
        (result as WebhookEndpoint & { secret?: string }).secret ?? null,
      );
      setFormData({ url: "", events: [], description: "" });
      setFormError(null);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.retryDeadLetterEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-dead-letter"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-stats"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-recent-events"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.url) {
      setFormError("URL is required");
      return;
    }

    if (formData.events.length === 0) {
      setFormError("Select at least one event");
      return;
    }

    createMutation.mutate({
      url: formData.url,
      events: formData.events,
      description: formData.description || undefined,
    });
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setCreatedSecret(null);
    setFormData({ url: "", events: [], description: "" });
    setFormError(null);
  };

  const getHealthBadge = (health: EndpointHealth["health"]) => {
    switch (health) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "unhealthy":
        return "bg-red-100 text-red-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "dead_letter":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage endpoints and monitor webhook delivery
          </p>
        </div>
        {activeTab === "endpoints" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Add Endpoint
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("endpoints")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "endpoints"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Endpoints
          </button>
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "monitoring"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Monitoring
          </button>
          <button
            onClick={() => setActiveTab("dead-letter")}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === "dead-letter"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Dead Letter Queue
            {stats && stats.totalDeadLetter > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                {stats.totalDeadLetter}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Endpoints Tab */}
      {activeTab === "endpoints" && (
        <>
          {isLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-red-500">Error loading webhooks</div>
          ) : data?.data?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-gray-900">
                No webhook endpoints
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create an endpoint to receive event notifications
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.data?.map((endpoint: WebhookEndpoint) => (
                <div key={endpoint.id} className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm text-gray-900 truncate">
                          {endpoint.url}
                        </span>
                        <span
                          className={`px-2 text-xs font-semibold rounded-full ${
                            endpoint.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {endpoint.status}
                        </span>
                      </div>
                      {endpoint.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {endpoint.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {endpoint.events.map((event) => (
                          <span
                            key={event}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (
                          confirm("Are you sure you want to delete this endpoint?")
                        ) {
                          deleteMutation.mutate(endpoint.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="ml-4 text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Monitoring Tab */}
      {activeTab === "monitoring" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Delivered</div>
              <div className="mt-1 text-2xl font-semibold text-green-600">
                {stats?.totalDelivered ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Pending</div>
              <div className="mt-1 text-2xl font-semibold text-yellow-600">
                {stats?.totalPending ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Failed</div>
              <div className="mt-1 text-2xl font-semibold text-red-600">
                {stats?.totalFailed ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Delivery Rate</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {stats?.deliveryRate ?? 100}%
              </div>
              <div className="text-xs text-gray-400">
                Avg {stats?.averageAttempts ?? 1} attempts
              </div>
            </div>
          </div>

          {/* Endpoint Health */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Endpoint Health</h3>
            </div>
            <div className="p-4">
              {!endpointHealth || endpointHealth.length === 0 ? (
                <p className="text-sm text-gray-500">No endpoints configured</p>
              ) : (
                <div className="space-y-3">
                  {endpointHealth.map((ep: EndpointHealth) => (
                    <div
                      key={ep.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getHealthBadge(
                              ep.health,
                            )}`}
                          >
                            {ep.health}
                          </span>
                          <span className="font-mono text-sm text-gray-900 truncate">
                            {ep.url}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                          <span>
                            {ep.deliveryRate}% success ({ep.successCount}/
                            {ep.successCount + ep.failureCount})
                          </span>
                          {ep.pendingEvents > 0 && (
                            <span className="text-yellow-600">
                              {ep.pendingEvents} pending
                            </span>
                          )}
                          {ep.lastDeliveryAt && (
                            <span>Last delivery: {formatDate(ep.lastDeliveryAt)}</span>
                          )}
                        </div>
                        {ep.lastError && (
                          <div className="mt-1 text-xs text-red-600">
                            Last error: {ep.lastError}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Event Type Breakdown */}
          {eventTypeBreakdown && eventTypeBreakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Event Type Breakdown (Last 7 Days)
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {eventTypeBreakdown.map((et) => (
                    <div key={et.eventType} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500 truncate">
                        {et.eventType}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">
                        {et.count}
                      </div>
                      <div className="text-xs text-gray-400">
                        {et.deliveryRate}% delivered
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Events */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border-gray-300 rounded-md"
              >
                <option value="all">All statuses</option>
                <option value="delivered">Delivered</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Endpoint
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Attempts
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!recentEvents?.data || recentEvents.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No recent events
                      </td>
                    </tr>
                  ) : (
                    recentEvents.data.map((event: WebhookEventSummary) => (
                      <tr key={event.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {event.eventType}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-xs">
                          {event.endpointUrl}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(
                              event.status,
                            )}`}
                          >
                            {event.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {event.attempts}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(event.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dead Letter Tab */}
      {activeTab === "dead-letter" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Dead Letter Queue</h3>
            <p className="text-sm text-gray-500">
              Events that have exhausted all retry attempts
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Event Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Failure Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Attempt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!deadLetterEvents?.data || deadLetterEvents.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No dead letter events
                    </td>
                  </tr>
                ) : (
                  deadLetterEvents.data.map((event: WebhookDeadLetterSummary) => (
                    <tr key={event.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {event.eventType}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-xs">
                        {event.endpointUrl}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                        {event.failureReason}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {event.attempts}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(event.lastAttemptAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            if (
                              confirm("Retry this event? It will be requeued for delivery.")
                            ) {
                              retryMutation.mutate(event.id);
                            }
                          }}
                          disabled={retryMutation.isPending}
                          className="text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={closeModal}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              {createdSecret ? (
                // Success: Show the secret
                <div>
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-center text-gray-900">
                    Endpoint Created
                  </h3>
                  <p className="mt-2 text-sm text-center text-gray-500">
                    Save this secret now. It will only be shown once!
                  </p>
                  <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-green-400 break-all">
                        {createdSecret}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdSecret);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-white"
                        title="Copy to clipboard"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Use this secret to verify webhook signatures in your
                    application.
                  </p>
                  <button
                    onClick={closeModal}
                    className="mt-6 w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                // Form
                <form onSubmit={handleSubmit}>
                  <h3 className="text-lg font-medium text-gray-900">
                    Add Webhook Endpoint
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Configure a URL to receive event notifications
                  </p>

                  {formError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-600">{formError}</p>
                    </div>
                  )}

                  <div className="mt-4 space-y-4">
                    {/* URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Endpoint URL
                      </label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) =>
                          setFormData({ ...formData, url: e.target.value })
                        }
                        placeholder="https://api.example.com/webhooks/zentla"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Must be HTTPS (HTTP allowed for localhost in test mode)
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="e.g., Production - User provisioning"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </div>

                    {/* Events */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Events to receive
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                        {AVAILABLE_EVENTS.map((event) => (
                          <label
                            key={event.value}
                            className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={formData.events.includes(event.value)}
                              onChange={() => toggleEvent(event.value)}
                              className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {event.label}
                              </span>
                              <p className="text-xs text-gray-500">
                                {event.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formData.events.length} event
                        {formData.events.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="btn-primary"
                    >
                      {createMutation.isPending
                        ? "Creating..."
                        : "Create Endpoint"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
