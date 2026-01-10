import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Refund } from "../lib/types";

type StatusFilter = "all" | "pending" | "succeeded" | "failed" | "canceled";

export function RefundsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["refunds", statusFilter],
    queryFn: () =>
      api.refunds.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
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
        return "Duplicate";
      case "fraudulent":
        return "Fraudulent";
      case "requested_by_customer":
        return "Customer Request";
      case "expired_uncaptured_charge":
        return "Expired";
      default:
        return "-";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">Error loading refunds</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No refunds found</p>
          <p className="mt-2 text-sm text-gray-400">
            Refunds will appear here when they are processed
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Refund
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.data?.map((refund: Refund) => (
                <tr
                  key={refund.id}
                  onClick={() => navigate(`/refunds/${refund.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {refund.providerRefundId}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {refund.id.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {refund.customer?.email ?? "N/A"}
                    </div>
                    {refund.customer?.name && (
                      <div className="text-xs text-gray-500">
                        {refund.customer.name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatCurrency(refund.amount, refund.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(refund.status)}`}
                    >
                      {refund.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {getReasonLabel(refund.reason)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(refund.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
