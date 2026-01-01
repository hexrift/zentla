import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "../lib/api";

type Tab = "details" | "entitlements";

interface Subscription {
  id: string;
  status: string;
  customer: { id: string; email: string; name?: string };
  offer: { id: string; name: string };
  offerVersion: {
    id: string;
    version: number;
    config: Record<string, unknown>;
  };
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  cancelAt?: string;
  canceledAt?: string;
  createdAt: string;
}

interface Entitlement {
  featureKey: string;
  hasAccess: boolean;
  value?: string | number | boolean;
  valueType?: string;
}

interface CustomerEntitlements {
  customerId: string;
  entitlements: Entitlement[];
  activeSubscriptionIds: string[];
}

export function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription", id],
    queryFn: async () => {
      const data = await api.subscriptions.get(id!);
      return data as unknown as Subscription;
    },
    enabled: !!id,
  });

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements", subscription?.customer?.id],
    queryFn: async () => {
      const data = await api.customers.getEntitlements(
        subscription!.customer.id,
      );
      return data as unknown as CustomerEntitlements;
    },
    enabled: !!subscription?.customer?.id,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.subscriptions.cancel(id!, {
        cancelAtPeriodEnd,
        reason: cancelReason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", id] });
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      setShowCancelModal(false);
    },
  });

  const tabs: { id: Tab; name: string }[] = [
    { id: "details", name: "Details" },
    { id: "entitlements", name: "Entitlements" },
  ];

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!subscription) {
    return <div className="text-red-500">Subscription not found</div>;
  }

  const isActive = ["active", "trialing"].includes(subscription.status);
  const isPendingCancel = !!subscription.cancelAt && !subscription.canceledAt;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate("/subscriptions")}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            &larr; Back to Subscriptions
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Subscription for {subscription.customer.email}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {subscription.offer.name} &middot; Created{" "}
            {new Date(subscription.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <span
            className={clsx(
              "px-3 py-1 text-sm font-semibold rounded-full",
              subscription.status === "active" && "bg-green-100 text-green-800",
              subscription.status === "trialing" && "bg-blue-100 text-blue-800",
              subscription.status === "canceled" && "bg-red-100 text-red-800",
              subscription.status === "past_due" &&
                "bg-yellow-100 text-yellow-800",
              !["active", "trialing", "canceled", "past_due"].includes(
                subscription.status,
              ) && "bg-gray-100 text-gray-800",
            )}
          >
            {isPendingCancel ? "Canceling" : subscription.status}
          </span>
          {isActive && !isPendingCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Pending cancellation banner */}
      {isPendingCancel && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            This subscription will be canceled on{" "}
            <strong>
              {new Date(subscription.cancelAt!).toLocaleDateString()}
            </strong>{" "}
            at the end of the current billing period.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "py-4 px-1 text-sm font-medium border-b-2",
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6 bg-white rounded-lg shadow">
        {activeTab === "details" && <DetailsTab subscription={subscription} />}
        {activeTab === "entitlements" && (
          <EntitlementsTab entitlements={entitlements?.entitlements ?? []} />
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Cancel Subscription
            </h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    checked={cancelAtPeriodEnd}
                    onChange={() => setCancelAtPeriodEnd(true)}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Cancel at end of billing period (
                    {new Date(
                      subscription.currentPeriodEnd,
                    ).toLocaleDateString()}
                    )
                  </span>
                </label>
              </div>
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    checked={!cancelAtPeriodEnd}
                    onChange={() => setCancelAtPeriodEnd(false)}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">
                    Cancel immediately
                  </span>
                </label>
                {!cancelAtPeriodEnd && (
                  <p className="ml-7 mt-1 text-xs text-red-600">
                    Entitlements will be revoked immediately
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Why is this subscription being canceled?"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="btn-secondary"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="btn-danger"
              >
                {cancelMutation.isPending
                  ? "Canceling..."
                  : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailsTab({ subscription }: { subscription: Subscription }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          Subscription Info
        </h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">Subscription ID</dt>
            <dd className="text-sm font-mono text-gray-900">
              {subscription.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Status</dt>
            <dd className="text-sm text-gray-900">{subscription.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Offer</dt>
            <dd className="text-sm text-gray-900">
              {subscription.offer.name} (v{subscription.offerVersion.version})
            </dd>
          </div>
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-4">Customer</h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">Email</dt>
            <dd className="text-sm text-gray-900">
              {subscription.customer.email}
            </dd>
          </div>
          {subscription.customer.name && (
            <div>
              <dt className="text-xs text-gray-500">Name</dt>
              <dd className="text-sm text-gray-900">
                {subscription.customer.name}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500">Customer ID</dt>
            <dd className="text-sm font-mono text-gray-900">
              {subscription.customer.id}
            </dd>
          </div>
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          Billing Period
        </h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">Current Period Start</dt>
            <dd className="text-sm text-gray-900">
              {new Date(subscription.currentPeriodStart).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Current Period End</dt>
            <dd className="text-sm text-gray-900">
              {new Date(subscription.currentPeriodEnd).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
      {(subscription.trialStart || subscription.trialEnd) && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-4">Trial</h3>
          <dl className="space-y-3">
            {subscription.trialStart && (
              <div>
                <dt className="text-xs text-gray-500">Trial Start</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(subscription.trialStart).toLocaleString()}
                </dd>
              </div>
            )}
            {subscription.trialEnd && (
              <div>
                <dt className="text-xs text-gray-500">Trial End</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(subscription.trialEnd).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
      {subscription.canceledAt && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            Cancellation
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500">Canceled At</dt>
              <dd className="text-sm text-gray-900">
                {new Date(subscription.canceledAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function EntitlementsTab({ entitlements }: { entitlements: Entitlement[] }) {
  if (entitlements.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No active entitlements for this subscription
      </div>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Feature Key
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Access
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Value
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Type
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {entitlements.map((e) => (
          <tr key={e.featureKey}>
            <td className="px-4 py-3 text-sm font-medium text-gray-900">
              {e.featureKey}
            </td>
            <td className="px-4 py-3">
              <span
                className={clsx(
                  "px-2 py-1 text-xs font-semibold rounded-full",
                  e.hasAccess
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800",
                )}
              >
                {e.hasAccess ? "Yes" : "No"}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
              {e.value !== undefined ? String(e.value) : "-"}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
              {e.valueType ?? "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
