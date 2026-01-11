import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "../lib/api";
import type {
  Customer,
  Subscription,
  Invoice,
  Credit,
  CreditBalance,
} from "../lib/types";

type Tab = "details" | "subscriptions" | "invoices" | "credits";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.customers.get(id!),
    enabled: !!id,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["subscriptions", { customerId: id }],
    queryFn: () => api.subscriptions.list({ customerId: id, limit: 50 }),
    enabled: !!id && activeTab === "subscriptions",
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices", { customerId: id }],
    queryFn: () => api.invoices.list({ customerId: id, limit: 50 }),
    enabled: !!id && activeTab === "invoices",
  });

  const { data: credits } = useQuery({
    queryKey: ["credits", { customerId: id }],
    queryFn: () => api.credits.list({ customerId: id, limit: 50 }),
    enabled: !!id && activeTab === "credits",
  });

  const { data: creditBalance } = useQuery({
    queryKey: ["creditBalance", id],
    queryFn: () => api.credits.getBalance(id!),
    enabled: !!id && activeTab === "credits",
  });

  const tabs: { id: Tab; name: string }[] = [
    { id: "details", name: "Details" },
    { id: "subscriptions", name: "Subscriptions" },
    { id: "invoices", name: "Invoices" },
    { id: "credits", name: "Credits" },
  ];

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!customer) {
    return <div className="text-red-500">Customer not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate("/customers")}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            &larr; Back to Customers
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{customer.email}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {customer.name ?? "No name"} &middot; Created{" "}
            {new Date(customer.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

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
        {activeTab === "details" && <DetailsTab customer={customer} />}
        {activeTab === "subscriptions" && (
          <SubscriptionsTab
            subscriptions={subscriptions?.data ?? []}
            onNavigate={(subId) => navigate(`/subscriptions/${subId}`)}
          />
        )}
        {activeTab === "invoices" && (
          <InvoicesTab
            invoices={invoices?.data ?? []}
            onNavigate={(invId) => navigate(`/invoices/${invId}`)}
          />
        )}
        {activeTab === "credits" && (
          <CreditsTab
            customerId={id!}
            credits={credits?.data ?? []}
            balance={creditBalance ?? []}
            queryClient={queryClient}
          />
        )}
      </div>
    </div>
  );
}

function DetailsTab({ customer }: { customer: Customer }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          Customer Info
        </h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">Customer ID</dt>
            <dd className="text-sm font-mono text-gray-900">{customer.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Email</dt>
            <dd className="text-sm text-gray-900">{customer.email}</dd>
          </div>
          {customer.name && (
            <div>
              <dt className="text-xs text-gray-500">Name</dt>
              <dd className="text-sm text-gray-900">{customer.name}</dd>
            </div>
          )}
          {customer.externalId && (
            <div>
              <dt className="text-xs text-gray-500">External ID</dt>
              <dd className="text-sm font-mono text-gray-900">
                {customer.externalId}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500">Created</dt>
            <dd className="text-sm text-gray-900">
              {new Date(customer.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function SubscriptionsTab({
  subscriptions,
  onNavigate,
}: {
  subscriptions: Subscription[];
  onNavigate: (id: string) => void;
}) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No subscriptions for this customer
      </div>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Offer
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Status
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Period End
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Created
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {subscriptions.map((sub) => (
          <tr
            key={sub.id}
            className="hover:bg-gray-50 cursor-pointer"
            onClick={() => onNavigate(sub.id)}
          >
            <td className="px-4 py-3 text-sm text-primary-600 font-medium">
              {sub.offer.name}
            </td>
            <td className="px-4 py-3">
              <span
                className={clsx(
                  "px-2 py-1 text-xs font-semibold rounded-full",
                  sub.status === "active" && "bg-green-100 text-green-800",
                  sub.status === "trialing" && "bg-blue-100 text-blue-800",
                  sub.status === "canceled" && "bg-red-100 text-red-800",
                  !["active", "trialing", "canceled"].includes(sub.status) &&
                    "bg-gray-100 text-gray-800",
                )}
              >
                {sub.status}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
              {new Date(sub.currentPeriodEnd).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
              {new Date(sub.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvoicesTab({
  invoices,
  onNavigate,
}: {
  invoices: Invoice[];
  onNavigate: (id: string) => void;
}) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No invoices for this customer
      </div>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Invoice
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Amount
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Status
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
            Date
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {invoices.map((inv) => (
          <tr
            key={inv.id}
            className="hover:bg-gray-50 cursor-pointer"
            onClick={() => onNavigate(inv.id)}
          >
            <td className="px-4 py-3 text-sm text-primary-600 font-mono">
              {inv.providerInvoiceId}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              {formatCurrency(inv.total, inv.currency)}
            </td>
            <td className="px-4 py-3">
              <span
                className={clsx(
                  "px-2 py-1 text-xs font-semibold rounded-full",
                  inv.status === "paid" && "bg-green-100 text-green-800",
                  inv.status === "open" && "bg-yellow-100 text-yellow-800",
                  inv.status === "void" && "bg-gray-100 text-gray-800",
                  !["paid", "open", "void"].includes(inv.status) &&
                    "bg-gray-100 text-gray-800",
                )}
              >
                {inv.status}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
              {new Date(inv.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CreditsTab({
  customerId,
  credits,
  balance,
  queryClient,
}: {
  customerId: string;
  credits: Credit[];
  balance: CreditBalance[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState<string | null>(null);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadgeClass = (status: Credit["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "depleted":
        return "bg-blue-100 text-blue-800";
      case "expired":
        return "bg-yellow-100 text-yellow-800";
      case "voided":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getReasonLabel = (reason?: Credit["reason"]) => {
    const labels: Record<NonNullable<Credit["reason"]>, string> = {
      promotional: "Promotional",
      refund_alternative: "Refund Alternative",
      goodwill: "Goodwill",
      billing_error: "Billing Error",
      service_credit: "Service Credit",
      other: "Other",
    };
    return reason ? labels[reason] : "-";
  };

  return (
    <div>
      {/* Balance Summary */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Credit Balance
          </h3>
          {balance.length === 0 ? (
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          ) : (
            <div className="flex space-x-4">
              {balance.map((b) => (
                <div key={b.currency}>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(b.totalBalance, b.currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {b.activeCredits} active credit
                    {b.activeCredits !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
        >
          Issue Credit
        </button>
      </div>

      {/* Credits Table */}
      {credits.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No credits for this customer
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Balance
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Reason
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Expires
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {credits.map((credit) => (
              <tr key={credit.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(credit.amount, credit.currency)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {formatCurrency(credit.balance, credit.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "px-2 py-1 text-xs font-semibold rounded-full",
                      getStatusBadgeClass(credit.status),
                    )}
                  >
                    {credit.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {getReasonLabel(credit.reason)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {credit.expiresAt
                    ? new Date(credit.expiresAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(credit.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {credit.status === "active" && (
                    <button
                      onClick={() => setShowVoidModal(credit.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Issue Credit Modal */}
      {showIssueModal && (
        <IssueCreditModal
          customerId={customerId}
          onClose={() => setShowIssueModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["credits", { customerId }],
            });
            queryClient.invalidateQueries({ queryKey: ["creditBalance"] });
            setShowIssueModal(false);
          }}
        />
      )}

      {/* Void Credit Modal */}
      {showVoidModal && (
        <VoidCreditModal
          creditId={showVoidModal}
          onClose={() => setShowVoidModal(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["credits", { customerId }],
            });
            queryClient.invalidateQueries({ queryKey: ["creditBalance"] });
            setShowVoidModal(null);
          }}
        />
      )}
    </div>
  );
}

function IssueCreditModal({
  customerId,
  onClose,
  onSuccess,
}: {
  customerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [reason, setReason] = useState<Credit["reason"]>("promotional");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.credits.create({
        customerId,
        amount: Math.round(parseFloat(amount) * 100),
        currency,
        reason,
        description: description || undefined,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Issue Credit
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="10.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
                <option value="gbp">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as Credit["reason"])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="promotional">Promotional</option>
              <option value="refund_alternative">Refund Alternative</option>
              <option value="goodwill">Goodwill</option>
              <option value="billing_error">Billing Error</option>
              <option value="service_credit">Service Credit</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Reason for issuing this credit..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expires (optional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount}
            className="btn-primary"
          >
            {mutation.isPending ? "Issuing..." : "Issue Credit"}
          </button>
        </div>
        {mutation.isError && (
          <p className="mt-2 text-sm text-red-600">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}

function VoidCreditModal({
  creditId,
  onClose,
  onSuccess,
}: {
  creditId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.credits.void(creditId, reason || undefined),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Void Credit
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to void this credit? This will set its balance
          to zero and cannot be undone.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Why is this credit being voided?"
          />
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-danger"
          >
            {mutation.isPending ? "Voiding..." : "Void Credit"}
          </button>
        </div>
        {mutation.isError && (
          <p className="mt-2 text-sm text-red-600">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
