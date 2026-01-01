import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
  currentVersion?: {
    id: string;
    version: number;
    status: string;
    config: {
      discountType: "percent" | "fixed_amount" | "free_trial_days";
      discountValue: number;
      currency?: string;
    };
  };
  createdAt: string;
}

export function PromotionsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["promotions", search],
    queryFn: () => api.promotions.list({ search }),
  });

  const formatDiscount = (promotion: Promotion) => {
    if (!promotion.currentVersion) return "-";
    const { discountType, discountValue, currency } =
      promotion.currentVersion.config;

    switch (discountType) {
      case "percent":
        return `${discountValue}% off`;
      case "fixed_amount":
        return `${(discountValue / 100).toFixed(2)} ${currency?.toUpperCase() || "USD"} off`;
      case "free_trial_days":
        return `${discountValue} day trial`;
      default:
        return "-";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <Link
          to="/promotions/new"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
        >
          Create Promotion
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search promotions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">Error loading promotions</div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(data?.data as Promotion[] | undefined)?.map((promotion) => (
                <tr key={promotion.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded">
                      {promotion.code}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/promotions/${promotion.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-purple-600"
                    >
                      {promotion.name}
                    </Link>
                    {promotion.description && (
                      <div className="text-sm text-gray-500">
                        {promotion.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDiscount(promotion)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        promotion.status === "active"
                          ? "bg-green-100 text-green-800"
                          : promotion.status === "draft"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {promotion.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {promotion.currentVersion
                      ? `v${promotion.currentVersion.version}`
                      : "Draft"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(promotion.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/promotions/${promotion.id}`}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.data?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No promotions found. Create your first promotion to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
