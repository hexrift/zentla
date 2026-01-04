import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useWorkspace } from "../lib/workspace-context";

interface AnalyticsData {
  mrr: number;
  mrrChange: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  churnRate: number;
  totalCustomers: number;
  newCustomers: number;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  valuePrefix,
  isLoading,
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  valuePrefix?: string;
  isLoading?: boolean;
}) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      {isLoading ? (
        <div className="mt-2 h-9 bg-gray-100 rounded animate-pulse" />
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {valuePrefix}
            {value}
          </p>
          {change !== undefined && (
            <p
              className={`mt-1 text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}
            >
              {formatPercent(change)} {changeLabel}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ChurnIndicator({
  rate,
  isLoading,
}: {
  rate: number;
  isLoading?: boolean;
}) {
  const getChurnColor = (rate: number) => {
    if (rate <= 2) return "text-green-600 bg-green-100";
    if (rate <= 5) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getChurnLabel = (rate: number) => {
    if (rate <= 2) return "Excellent";
    if (rate <= 5) return "Average";
    return "Needs Attention";
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500">Monthly Churn Rate</h3>
      {isLoading ? (
        <div className="mt-2 h-9 bg-gray-100 rounded animate-pulse" />
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {rate.toFixed(1)}%
          </p>
          <span
            className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChurnColor(rate)}`}
          >
            {getChurnLabel(rate)}
          </span>
        </>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const { formatCurrency } = useWorkspace();

  // Fetch subscriptions to calculate metrics
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ["subscriptions", { limit: 100 }],
    queryFn: () => api.subscriptions.list({ limit: 100 }),
  });

  const { data: customers, isLoading: custLoading } = useQuery({
    queryKey: ["customers", { limit: 100 }],
    queryFn: () => api.customers.list({ limit: 100 }),
  });

  const { data: offers } = useQuery({
    queryKey: ["offers", { limit: 100 }],
    queryFn: () => api.offers.list({ limit: 100 }),
  });

  const isLoading = subsLoading || custLoading;

  // Calculate metrics from data
  const analytics: AnalyticsData = (() => {
    const subs = subscriptions?.data ?? [];
    const custs = customers?.data ?? [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Active subscriptions
    const activeSubs = subs.filter(
      (s: { status: string }) =>
        s.status === "active" || s.status === "trialing",
    );

    // Calculate MRR from offer prices (simplified)
    const offerPrices = new Map<string, number>();
    (offers?.data ?? []).forEach(
      (o: {
        id: string;
        versions?: Array<{
          config?: { pricing?: { amount?: number; interval?: string } };
        }>;
      }) => {
        const version = o.versions?.[0];
        if (version?.config?.pricing?.amount) {
          const amount = version.config.pricing.amount;
          const interval = version.config.pricing.interval ?? "month";
          // Normalize to monthly
          const monthly = interval === "year" ? amount / 12 : amount;
          offerPrices.set(o.id, monthly);
        }
      },
    );

    let mrr = 0;
    activeSubs.forEach((s: { offer: { id: string } }) => {
      mrr += offerPrices.get(s.offer.id) ?? 0;
    });

    // New subscriptions in last 30 days
    const newSubs = subs.filter((s: { createdAt: string }) => {
      const created = new Date(s.createdAt);
      return created >= thirtyDaysAgo;
    });

    // Churned subscriptions (canceled in last 30 days)
    const churnedSubs = subs.filter(
      (s: { status: string; canceledAt?: string }) => {
        if (s.status !== "canceled" || !s.canceledAt) return false;
        const canceled = new Date(s.canceledAt);
        return canceled >= thirtyDaysAgo;
      },
    );

    // Previous period subscriptions for comparison
    const prevActiveSubs = subs.filter(
      (s: { createdAt: string; status: string; canceledAt?: string }) => {
        const created = new Date(s.createdAt);
        if (created > thirtyDaysAgo) return false;
        if (s.status === "canceled" && s.canceledAt) {
          const canceled = new Date(s.canceledAt);
          return canceled > sixtyDaysAgo && canceled <= thirtyDaysAgo;
        }
        return true;
      },
    );

    // Churn rate calculation
    const startOfPeriodSubs =
      activeSubs.length + churnedSubs.length - newSubs.length;
    const churnRate =
      startOfPeriodSubs > 0
        ? (churnedSubs.length / startOfPeriodSubs) * 100
        : 0;

    // New customers in last 30 days
    const newCustomers = custs.filter((c: { createdAt: string }) => {
      const created = new Date(c.createdAt);
      return created >= thirtyDaysAgo;
    });

    // MRR change estimate
    const mrrChange =
      prevActiveSubs.length > 0
        ? ((activeSubs.length - prevActiveSubs.length) /
            prevActiveSubs.length) *
          100
        : 0;

    return {
      mrr,
      mrrChange,
      activeSubscriptions: activeSubs.length,
      newSubscriptions: newSubs.length,
      churnedSubscriptions: churnedSubs.length,
      churnRate,
      totalCustomers: custs.length,
      newCustomers: newCustomers.length,
    };
  })();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Key metrics for your subscription business
        </p>
      </div>

      {/* Revenue Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monthly Recurring Revenue"
            value={formatCurrency(analytics.mrr / 100)}
            change={analytics.mrrChange}
            changeLabel="vs last month"
            isLoading={isLoading}
          />
          <MetricCard
            title="Active Subscriptions"
            value={analytics.activeSubscriptions}
            isLoading={isLoading}
          />
          <MetricCard
            title="New Subscriptions (30d)"
            value={analytics.newSubscriptions}
            isLoading={isLoading}
          />
          <ChurnIndicator rate={analytics.churnRate} isLoading={isLoading} />
        </div>
      </div>

      {/* Customer Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Customers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Customers"
            value={analytics.totalCustomers}
            isLoading={isLoading}
          />
          <MetricCard
            title="New Customers (30d)"
            value={analytics.newCustomers}
            isLoading={isLoading}
          />
          <MetricCard
            title="Churned Subscriptions (30d)"
            value={analytics.churnedSubscriptions}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Churn Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Understanding Your Metrics
        </h2>
        <div className="prose prose-sm text-gray-600">
          <ul>
            <li>
              <strong>MRR</strong>: Monthly Recurring Revenue is calculated from
              active and trialing subscriptions using offer pricing.
            </li>
            <li>
              <strong>Churn Rate</strong>: Percentage of subscriptions canceled
              in the last 30 days relative to the starting subscriber count.
              Industry benchmark is 3-5% monthly.
            </li>
            <li>
              <strong>Active Subscriptions</strong>: Subscriptions with status
              "active" or "trialing".
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
