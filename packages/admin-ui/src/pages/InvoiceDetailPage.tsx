import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "../lib/api";
import type { Invoice } from "../lib/types";

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.invoices.get(id!),
    enabled: !!id,
  });

  const voidMutation = useMutation({
    mutationFn: () => api.invoices.void(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowVoidModal(false);
    },
  });

  const payMutation = useMutation({
    mutationFn: () => api.invoices.pay(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowPayModal(false);
    },
  });

  const downloadPdf = async () => {
    try {
      const { url } = await api.invoices.getPdfUrl(id!);
      window.open(url, "_blank");
    } catch (error) {
      alert("Failed to get PDF URL");
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadgeClass = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "open":
        return "bg-blue-100 text-blue-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "void":
        return "bg-red-100 text-red-800";
      case "uncollectible":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!invoice) {
    return <div className="text-red-500">Invoice not found</div>;
  }

  const canVoid = invoice.status === "open" || invoice.status === "draft";
  const canPay = invoice.status === "open";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate("/invoices")}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            &larr; Back to Invoices
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice {invoice.providerInvoiceId}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Created {new Date(invoice.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <span
            className={clsx(
              "px-3 py-1 text-sm font-semibold rounded-full",
              getStatusBadgeClass(invoice.status),
            )}
          >
            {invoice.status}
          </span>
          <button
            onClick={downloadPdf}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Download PDF
          </button>
          {canPay && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
            >
              Collect Payment
            </button>
          )}
          {canVoid && (
            <button
              onClick={() => setShowVoidModal(true)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
            >
              Void Invoice
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Invoice Details */}
        <div className="col-span-2 space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Summary
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Subtotal</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Tax</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatCurrency(invoice.tax, invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total</dt>
                <dd className="text-xl font-bold text-gray-900">
                  {formatCurrency(invoice.total, invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Amount Due</dt>
                <dd
                  className={clsx(
                    "text-xl font-bold",
                    invoice.amountRemaining > 0
                      ? "text-red-600"
                      : "text-green-600",
                  )}
                >
                  {formatCurrency(invoice.amountRemaining, invoice.currency)}
                </dd>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Line Items
            </h2>
            {invoice.lineItems && invoice.lineItems.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {item.description}
                        </div>
                        {item.periodStart && item.periodEnd && (
                          <div className="text-xs text-gray-500">
                            {new Date(item.periodStart).toLocaleDateString()} -{" "}
                            {new Date(item.periodEnd).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unitAmount, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.amount, item.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No line items</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Customer
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">
                  {invoice.customer?.email ?? "N/A"}
                </dd>
              </div>
              {invoice.customer?.name && (
                <div>
                  <dt className="text-xs text-gray-500">Name</dt>
                  <dd className="text-sm text-gray-900">
                    {invoice.customer.name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">Customer ID</dt>
                <dd className="text-sm font-mono text-gray-900">
                  {invoice.customerId}
                </dd>
              </div>
            </dl>
          </div>

          {/* Invoice Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Details
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Invoice ID</dt>
                <dd className="text-sm font-mono text-gray-900">
                  {invoice.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Provider</dt>
                <dd className="text-sm text-gray-900 capitalize">
                  {invoice.provider}
                </dd>
              </div>
              {invoice.dueDate && (
                <div>
                  <dt className="text-xs text-gray-500">Due Date</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  <dt className="text-xs text-gray-500">Paid At</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(invoice.paidAt).toLocaleString()}
                  </dd>
                </div>
              )}
              {invoice.voidedAt && (
                <div>
                  <dt className="text-xs text-gray-500">Voided At</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(invoice.voidedAt).toLocaleString()}
                  </dd>
                </div>
              )}
              {invoice.periodStart && invoice.periodEnd && (
                <div>
                  <dt className="text-xs text-gray-500">Billing Period</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(invoice.periodStart).toLocaleDateString()} -{" "}
                    {new Date(invoice.periodEnd).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {invoice.subscriptionId && (
                <div>
                  <dt className="text-xs text-gray-500">Subscription</dt>
                  <dd>
                    <button
                      onClick={() =>
                        navigate(`/subscriptions/${invoice.subscriptionId}`)
                      }
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      View Subscription
                    </button>
                  </dd>
                </div>
              )}
              {invoice.attemptCount > 0 && (
                <div>
                  <dt className="text-xs text-gray-500">Payment Attempts</dt>
                  <dd className="text-sm text-gray-900">
                    {invoice.attemptCount}
                  </dd>
                </div>
              )}
              {invoice.nextPaymentAttempt && (
                <div>
                  <dt className="text-xs text-gray-500">Next Attempt</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(invoice.nextPaymentAttempt).toLocaleString()}
                  </dd>
                </div>
              )}
              {invoice.providerInvoiceUrl && (
                <div>
                  <dt className="text-xs text-gray-500">Provider Link</dt>
                  <dd>
                    <a
                      href={invoice.providerInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      View in {invoice.provider}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Void Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Void Invoice
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to void this invoice? This action cannot be
              undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowVoidModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending}
                className="btn-danger"
              >
                {voidMutation.isPending ? "Voiding..." : "Void Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Collect Payment
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              This will trigger a payment attempt for{" "}
              {formatCurrency(invoice.amountRemaining, invoice.currency)}. The
              customer's default payment method will be charged.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {payMutation.isPending ? "Processing..." : "Collect Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
