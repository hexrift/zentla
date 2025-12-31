import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { WebhookEndpoint } from "../lib/types";

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

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateFormData>({
    url: "",
    events: [],
    description: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => api.webhooks.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      url: string;
      events: string[];
      description?: string;
    }) => api.webhooks.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      // Show the secret (it's only shown once!)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Webhook Endpoints
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Receive real-time notifications when events happen in your workspace
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Add Endpoint
        </button>
      </div>

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
                    className="mt-6 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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
                        placeholder="https://api.example.com/webhooks/relay"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                              className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
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
