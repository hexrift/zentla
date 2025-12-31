import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { clsx } from "clsx";
import type { CheckoutSession, CheckoutIntent, Offer } from "../lib/types";

type Tab = "sessions" | "intents";

const sessionStatuses = ["pending", "open", "complete", "expired"];
const intentStatuses = [
  "pending",
  "processing",
  "requires_action",
  "succeeded",
  "failed",
  "expired",
];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRelativeTime(date: string): string {
  const now = new Date();
  const created = new Date(date);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

function isStale(date: string, status: string): boolean {
  if (status !== "pending" && status !== "open" && status !== "processing")
    return false;
  const created = new Date(date);
  const diffMs = Date.now() - created.getTime();
  const diffMins = diffMs / 60000;
  return diffMins > 10; // Consider stale after 10 minutes
}

function StatCard({
  label,
  value,
  suffix,
  color = "gray",
}: {
  label: string;
  value: number | string;
  suffix?: string;
  color?: "gray" | "green" | "blue" | "yellow" | "red" | "purple";
}) {
  const colorClasses = {
    gray: "bg-gray-50 border-gray-200",
    green: "bg-emerald-50 border-emerald-200",
    blue: "bg-blue-50 border-blue-200",
    yellow: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
    purple: "bg-purple-50 border-purple-200",
  };

  const valueColorClasses = {
    gray: "text-gray-900",
    green: "text-emerald-700",
    blue: "text-blue-700",
    yellow: "text-amber-700",
    red: "text-red-700",
    purple: "text-purple-700",
  };

  return (
    <div
      className={clsx(
        "rounded-xl border p-5 transition-all hover:shadow-sm",
        colorClasses[color],
      )}
    >
      <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
      <p
        className={clsx(
          "text-2xl font-semibold tracking-tight",
          valueColorClasses[color],
        )}
      >
        {value}
        {suffix && (
          <span className="text-sm font-normal text-gray-500 ml-1">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  type,
  createdAt,
  showRelativeTime = false,
}: {
  status: string;
  type: "session" | "intent";
  createdAt?: string;
  showRelativeTime?: boolean;
}) {
  const getStatusStyle = () => {
    if (type === "session") {
      switch (status) {
        case "complete":
          return "bg-emerald-100 text-emerald-700 ring-emerald-600/20";
        case "pending":
        case "open":
          return "bg-amber-100 text-amber-700 ring-amber-600/20";
        case "expired":
          return "bg-gray-100 text-gray-600 ring-gray-500/20";
        default:
          return "bg-gray-100 text-gray-600 ring-gray-500/20";
      }
    } else {
      switch (status) {
        case "succeeded":
          return "bg-emerald-100 text-emerald-700 ring-emerald-600/20";
        case "pending":
        case "processing":
          return "bg-blue-100 text-blue-700 ring-blue-600/20";
        case "requires_action":
          return "bg-amber-100 text-amber-700 ring-amber-600/20";
        case "failed":
          return "bg-red-100 text-red-700 ring-red-600/20";
        case "expired":
          return "bg-gray-100 text-gray-600 ring-gray-500/20";
        default:
          return "bg-gray-100 text-gray-600 ring-gray-500/20";
      }
    }
  };

  const stale = createdAt && isStale(createdAt, status);
  const relativeTime =
    createdAt &&
    showRelativeTime &&
    (status === "pending" || status === "open" || status === "processing")
      ? getRelativeTime(createdAt)
      : null;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        getStatusStyle(),
        stale && "animate-pulse",
      )}
    >
      {status.replace("_", " ")}
      {relativeTime && (
        <span className={clsx("ml-1", stale ? "text-red-600" : "opacity-70")}>
          · {relativeTime}
        </span>
      )}
    </span>
  );
}

function StripeLink({
  id,
  type,
}: {
  id: string;
  type: "payment_intent" | "session";
}) {
  const baseUrl = "https://dashboard.stripe.com/test";
  const path = type === "payment_intent" ? "payments" : "checkout/sessions";

  return (
    <a
      href={`${baseUrl}/${path}/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600 transition-colors"
      title="View in Stripe"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
      <span className="font-mono text-[10px]">{id.slice(0, 12)}...</span>
    </a>
  );
}

export function CheckoutsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("intents");
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [intentStatus, setIntentStatus] = useState<string>("");
  const [offerFilter, setOfferFilter] = useState<string>("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["checkout-stats"],
    queryFn: () => api.checkout.getStats(),
  });

  const { data: offers } = useQuery({
    queryKey: ["offers-list"],
    queryFn: () => api.offers.list({ limit: 100 }),
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["checkout-sessions", sessionStatus, offerFilter],
    queryFn: () =>
      api.checkout.listSessions({ status: sessionStatus || undefined }),
    enabled: activeTab === "sessions",
  });

  const { data: intents, isLoading: intentsLoading } = useQuery({
    queryKey: ["checkout-intents", intentStatus, offerFilter],
    queryFn: () =>
      api.checkout.listIntents({ status: intentStatus || undefined }),
    enabled: activeTab === "intents",
  });

  // Filter by offer on client side (could be moved to API)
  const filteredSessions =
    sessions?.data?.filter(
      (s: CheckoutSession) => !offerFilter || s.offer.id === offerFilter,
    ) || [];

  const filteredIntents =
    intents?.data?.filter(
      (i: CheckoutIntent) => !offerFilter || i.offer.id === offerFilter,
    ) || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Checkouts
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor checkout sessions and payment intents
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Total Checkouts"
              value={
                (stats?.sessions?.total || 0) + (stats?.intents?.total || 0)
              }
              color="purple"
            />
            <StatCard
              label="Completed"
              value={
                (stats?.sessions?.completed || 0) +
                (stats?.intents?.succeeded || 0)
              }
              color="green"
            />
            <StatCard
              label="Pending"
              value={
                (stats?.sessions?.pending || 0) +
                (stats?.intents?.pending || 0) +
                (stats?.intents?.processing || 0)
              }
              color="blue"
            />
            <StatCard
              label="Conversion Rate"
              value={
                stats?.intents?.total
                  ? `${stats.intents.conversionRate.toFixed(1)}%`
                  : stats?.sessions?.total
                    ? `${stats.sessions.conversionRate.toFixed(1)}%`
                    : "0%"
              }
              color="gray"
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("intents")}
            className={clsx(
              "whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors",
              activeTab === "intents"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
            )}
          >
            Checkout Intents
            {stats?.intents?.total ? (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {stats.intents.total}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={clsx(
              "whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors",
              activeTab === "sessions"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
            )}
          >
            Hosted Sessions
            {stats?.sessions?.total ? (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {stats.sessions.total}
              </span>
            ) : null}
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <select
          value={activeTab === "sessions" ? sessionStatus : intentStatus}
          onChange={(e) => {
            if (activeTab === "sessions") {
              setSessionStatus(e.target.value);
            } else {
              setIntentStatus(e.target.value);
            }
          }}
          className="flex-1 sm:flex-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
        >
          <option value="">All statuses</option>
          {(activeTab === "sessions" ? sessionStatuses : intentStatuses).map(
            (status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ),
          )}
        </select>

        <select
          value={offerFilter}
          onChange={(e) => setOfferFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
        >
          <option value="">All offers</option>
          {((offers?.data as Offer[]) || []).map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {activeTab === "sessions" ? (
            sessionsLoading ? (
              <div className="p-8 text-center text-gray-500">
                Loading sessions...
              </div>
            ) : !filteredSessions.length ? (
              <div className="p-12 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-medium text-gray-900">
                  No checkout sessions
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Checkout sessions appear here when customers start a purchase
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Offer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(filteredSessions as CheckoutSession[]).map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        {session.customer ? (
                          <Link
                            to={`/customers/${session.customer.id}`}
                            className="text-sm font-medium text-purple-600 hover:text-purple-800"
                          >
                            {session.customer.email}
                          </Link>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">
                            {session.customerEmail || "Unknown"}
                          </div>
                        )}
                        {session.customer?.name && (
                          <div className="text-sm text-gray-500">
                            {session.customer.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/offers/${session.offer.id}`}
                          className="text-sm text-purple-600 hover:text-purple-800"
                        >
                          {session.offer.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          status={session.status}
                          type="session"
                          createdAt={session.createdAt}
                          showRelativeTime
                        />
                      </td>
                      <td className="px-6 py-4">
                        {session.providerSessionId && (
                          <StripeLink
                            id={session.providerSessionId}
                            type="session"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(session.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : intentsLoading ? (
            <div className="p-8 text-center text-gray-500">
              Loading intents...
            </div>
          ) : !filteredIntents.length ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-medium text-gray-900">
                No checkout intents
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create intents via the API for headless checkout flows
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Offer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(filteredIntents as CheckoutIntent[]).map((intent) => (
                  <tr
                    key={intent.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {intent.customer ? (
                        <Link
                          to={`/customers/${intent.customer.id}`}
                          className="text-sm font-medium text-purple-600 hover:text-purple-800"
                        >
                          {intent.customer.email}
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-gray-900">
                          {intent.customerEmail || "Unknown"}
                        </div>
                      )}
                      {intent.customer?.name && (
                        <div className="text-sm text-gray-500">
                          {intent.customer.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/offers/${intent.offer.id}`}
                        className="text-sm text-purple-600 hover:text-purple-800"
                      >
                        {intent.offer.name}
                      </Link>
                      {intent.trialDays && (
                        <div className="text-xs text-blue-600">
                          {intent.trialDays} day trial
                        </div>
                      )}
                      {intent.promotion && (
                        <div className="text-xs text-purple-600">
                          {intent.promotion.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(intent.totalAmount, intent.currency)}
                      </div>
                      {intent.discountAmount > 0 && (
                        <div className="text-xs text-green-600">
                          -
                          {formatCurrency(
                            intent.discountAmount,
                            intent.currency,
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={intent.status}
                        type="intent"
                        createdAt={intent.createdAt}
                        showRelativeTime
                      />
                      {intent.subscription && (
                        <div className="mt-1">
                          <Link
                            to={`/subscriptions/${intent.subscription.id}`}
                            className="text-xs text-purple-600 hover:text-purple-800"
                          >
                            → Subscription
                          </Link>
                        </div>
                      )}
                      {intent.status === "failed" && intent.failureReason && (
                        <div
                          className="mt-1 text-xs text-red-600"
                          title={intent.failureReason}
                        >
                          {intent.failureReason.length > 30
                            ? intent.failureReason.slice(0, 30) + "..."
                            : intent.failureReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {intent.providerPaymentId && (
                        <StripeLink
                          id={intent.providerPaymentId}
                          type="payment_intent"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(intent.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
