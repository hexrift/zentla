import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useState } from "react";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

interface ChecklistItemProps {
  title: string;
  description: string;
  isComplete: boolean;
  isLoading?: boolean;
  linkTo?: string;
  linkText?: string;
  externalLink?: string;
}

function ChecklistItem({
  title,
  description,
  isComplete,
  isLoading,
  linkTo,
  linkText,
  externalLink,
}: ChecklistItemProps) {
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border ${isComplete ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isComplete ? "bg-green-100" : "bg-gray-100"}`}
      >
        {isLoading ? (
          <SpinnerIcon className="w-5 h-5 text-gray-400 animate-spin" />
        ) : isComplete ? (
          <CheckIcon className="w-5 h-5 text-green-600" />
        ) : (
          <XIcon className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className={`text-sm font-medium ${isComplete ? "text-green-900" : "text-gray-900"}`}
        >
          {title}
        </h3>
        <p
          className={`text-sm mt-0.5 ${isComplete ? "text-green-700" : "text-gray-500"}`}
        >
          {description}
        </p>
      </div>
      {!isComplete && linkTo && (
        <Link
          to={linkTo}
          className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          {linkText}
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      )}
      {!isComplete && externalLink && (
        <a
          href={externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          {linkText}
          <ArrowRightIcon className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<{
    customersImported: number;
    customersSkipped: number;
    subscriptionsImported: number;
    subscriptionsSkipped: number;
    errors: string[];
  } | null>(null);

  const { data: providerStatus, isLoading: providersLoading } = useQuery({
    queryKey: ["providerStatus"],
    queryFn: () => api.workspace.getProviderStatus(),
  });

  const { data: offers } = useQuery({
    queryKey: ["offers", { limit: 1 }],
    queryFn: () => api.offers.list({ limit: 1 }),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", { limit: 1 }],
    queryFn: () => api.customers.list({ limit: 1 }),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["subscriptions", { limit: 1 }],
    queryFn: () => api.subscriptions.list({ limit: 1 }),
  });

  const { data: webhooks } = useQuery({
    queryKey: ["webhooks", { limit: 1 }],
    queryFn: () => api.webhooks.list({ limit: 1 }),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.workspace.syncFromStripe(),
    onSuccess: (data) => {
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  const stripeProvider = providerStatus?.providers?.find(
    (p: { provider: string }) => p.provider === "stripe",
  ) as
    | {
        provider: string;
        status: string;
        mode: string | null;
        errors: string[];
      }
    | undefined;
  const isStripeConfigured = stripeProvider?.status === "connected";
  const stripeHasError = stripeProvider?.status === "error";
  const hasOffers = (offers?.data?.length ?? 0) > 0;
  const hasWebhooks = (webhooks?.data?.length ?? 0) > 0;
  const hasCustomers = (customers?.data?.length ?? 0) > 0;
  const hasSubscriptions = (subscriptions?.data?.length ?? 0) > 0;

  const completedSteps = [isStripeConfigured, hasOffers, hasWebhooks].filter(
    Boolean,
  ).length;

  const totalSteps = 3;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);
  const isSetupComplete = completedSteps === totalSteps;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to Relay. Complete the setup checklist to start accepting
          payments.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Setup Progress
          </span>
          <span className="text-sm text-gray-500">
            {completedSteps} of {totalSteps} steps complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${isSetupComplete ? "bg-green-500" : "bg-purple-600"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {isSetupComplete && (
          <p className="mt-2 text-sm text-green-600 font-medium">
            Setup complete! You're ready to accept payments.
          </p>
        )}
      </div>

      {/* Setup Checklist */}
      <div className="space-y-3 mb-8">
        <h2 className="text-lg font-medium text-gray-900">Setup Checklist</h2>

        <ChecklistItem
          title="Configure Billing"
          description={
            isStripeConfigured
              ? `Billing provider connected (${stripeProvider?.mode ?? "test"} mode)`
              : stripeHasError
                ? `Connection error: ${stripeProvider?.errors?.[0] ?? "Unknown error"}`
                : "Add your billing provider credentials to enable payment processing"
          }
          isComplete={isStripeConfigured}
          isLoading={providersLoading}
          linkTo="/settings"
          linkText={stripeHasError ? "Fix" : "Configure"}
        />

        <ChecklistItem
          title="Create an Offer"
          description={
            hasOffers
              ? "You have at least one offer configured"
              : "Create a pricing offer to sell to customers"
          }
          isComplete={hasOffers}
          linkTo="/offers/new"
          linkText="Create Offer"
        />

        <ChecklistItem
          title="Configure Webhooks"
          description={
            hasWebhooks
              ? "Webhook endpoint is configured"
              : "Set up a webhook endpoint to receive subscription events"
          }
          isComplete={hasWebhooks}
          linkTo="/webhooks"
          linkText="Add Webhook"
        />
      </div>

      {/* Sync from Stripe section */}
      {isStripeConfigured && (
        <div className="p-6 bg-white rounded-lg border border-gray-200 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                Sync from Stripe
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Import existing customers and subscriptions from Stripe that
                were created outside of Relay.
              </p>
            </div>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              <RefreshIcon
                className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </button>
          </div>

          {syncResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Sync Results
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div>
                    <span className="text-gray-500">Customers imported:</span>{" "}
                    <span className="font-medium text-green-600">
                      {syncResult.customersImported}
                    </span>
                  </div>
                  {syncResult.customersSkipped > 0 && (
                    <div>
                      <span className="text-gray-500">Already synced:</span>{" "}
                      <span className="font-medium text-gray-600">
                        {syncResult.customersSkipped}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-gray-500">
                      Subscriptions imported:
                    </span>{" "}
                    <span className="font-medium text-green-600">
                      {syncResult.subscriptionsImported}
                    </span>
                  </div>
                  {syncResult.subscriptionsSkipped > 0 && (
                    <div>
                      <span className="text-gray-500">Already synced:</span>{" "}
                      <span className="font-medium text-gray-600">
                        {syncResult.subscriptionsSkipped}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-amber-700">
                    Warnings ({syncResult.errors.length})
                  </h4>
                  <p className="text-xs text-gray-500 mb-1">
                    These items were skipped due to missing requirements
                  </p>
                  <ul className="mt-1 text-sm text-amber-600 list-disc list-inside">
                    {syncResult.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {syncResult.errors.length > 5 && (
                      <li>...and {syncResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {syncMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg text-sm text-red-700">
              Failed to sync: {(syncMutation.error as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/customers"
          className="p-6 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-medium text-gray-500">Customers</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {hasCustomers ? (customers?.data?.length ?? 0) : 0}
          </p>
          <p className="mt-1 text-sm text-purple-600">View all</p>
        </Link>

        <Link
          to="/subscriptions"
          className="p-6 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-medium text-gray-500">
            Active Subscriptions
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {hasSubscriptions ? (subscriptions?.data?.length ?? 0) : 0}
          </p>
          <p className="mt-1 text-sm text-purple-600">View all</p>
        </Link>

        <Link
          to="/offers"
          className="p-6 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-medium text-gray-500">Offers</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {hasOffers ? (offers?.data?.length ?? 0) : 0}
          </p>
          <p className="mt-1 text-sm text-purple-600">View all</p>
        </Link>
      </div>
    </div>
  );
}
