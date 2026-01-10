import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "../lib/api";
import type { Refund } from "../lib/types";

export function RefundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: refund, isLoading } = useQuery({
    queryKey: ["refund", id],
    queryFn: () => api.refunds.get(id!),
    enabled: !!id,
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadgeClass = (status: Refund["status"]) => {
    switch (status) {
      case "succeeded":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "canceled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getReasonLabel = (reason: Refund["reason"]) => {
    switch (reason) {
      case "duplicate":
        return "Duplicate charge";
      case "fraudulent":
        return "Fraudulent charge";
      case "requested_by_customer":
        return "Requested by customer";
      case "expired_uncaptured_charge":
        return "Expired uncaptured charge";
      default:
        return "Not specified";
    }
  };

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!refund) {
    return <div className="text-red-500">Refund not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate("/refunds")}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            &larr; Back to Refunds
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Refund {refund.providerRefundId}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Created {new Date(refund.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={clsx(
            "px-3 py-1 text-sm font-semibold rounded-full",
            getStatusBadgeClass(refund.status),
          )}
        >
          {refund.status}
        </span>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Refund Details */}
        <div className="col-span-2 space-y-6">
          {/* Amount Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Amount</h2>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(refund.amount, refund.currency)}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Currency: {refund.currency.toUpperCase()}
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Reason</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {getReasonLabel(refund.reason)}
                </dd>
              </div>
              {refund.failureReason && (
                <div className="col-span-2">
                  <dt className="text-sm text-gray-500">Failure Reason</dt>
                  <dd className="text-sm font-medium text-red-600">
                    {refund.failureReason}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Provider</dt>
                <dd className="text-sm font-medium text-gray-900 capitalize">
                  {refund.provider}
                </dd>
              </div>
              {refund.providerChargeId && (
                <div>
                  <dt className="text-sm text-gray-500">Charge ID</dt>
                  <dd className="text-sm font-mono text-gray-900">
                    {refund.providerChargeId}
                  </dd>
                </div>
              )}
              {refund.providerPaymentIntentId && (
                <div>
                  <dt className="text-sm text-gray-500">Payment Intent ID</dt>
                  <dd className="text-sm font-mono text-gray-900">
                    {refund.providerPaymentIntentId}
                  </dd>
                </div>
              )}
            </dl>
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
                  {refund.customer?.email ?? "N/A"}
                </dd>
              </div>
              {refund.customer?.name && (
                <div>
                  <dt className="text-xs text-gray-500">Name</dt>
                  <dd className="text-sm text-gray-900">
                    {refund.customer.name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">Customer ID</dt>
                <dd className="text-sm font-mono text-gray-900">
                  {refund.customerId}
                </dd>
              </div>
            </dl>
          </div>

          {/* Invoice Info */}
          {refund.invoice && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Invoice
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-gray-500">Invoice ID</dt>
                  <dd className="text-sm font-mono text-gray-900">
                    {refund.invoice.providerInvoiceId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Total</dt>
                  <dd className="text-sm text-gray-900">
                    {formatCurrency(
                      refund.invoice.total,
                      refund.invoice.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <button
                    onClick={() => navigate(`/invoices/${refund.invoiceId}`)}
                    className="text-sm text-primary-600 hover:text-primary-800"
                  >
                    View Invoice
                  </button>
                </div>
              </dl>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Metadata
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Refund ID</dt>
                <dd className="text-sm font-mono text-gray-900">{refund.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Provider Refund ID</dt>
                <dd className="text-sm font-mono text-gray-900">
                  {refund.providerRefundId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(refund.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Updated</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(refund.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
