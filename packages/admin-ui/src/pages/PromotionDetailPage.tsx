import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Promotion,
  PromotionVersion,
  Offer,
  PaginatedResponse,
} from "../lib/types";

export function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingOffers, setEditingOffers] = useState(false);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);

  const {
    data: promotion,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["promotion", id],
    queryFn: () => api.promotions.get(id!) as Promise<Promotion>,
    enabled: !!id,
  });

  // Fetch all active offers
  const { data: offersData } = useQuery({
    queryKey: ["offers", "active"],
    queryFn: () => api.offers.list({ status: "active", limit: 100 }),
  });

  const allOffers = (offersData as PaginatedResponse<Offer>)?.data ?? [];

  // Initialize selected offers when promotion loads
  useEffect(() => {
    if (promotion?.currentVersion?.config?.applicableOfferIds) {
      setSelectedOfferIds(
        promotion.currentVersion.config.applicableOfferIds as string[],
      );
    } else {
      setSelectedOfferIds([]);
    }
  }, [promotion]);

  const publishMutation = useMutation({
    mutationFn: (versionId?: string) => api.promotions.publish(id!, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion", id] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.promotions.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion", id] });
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
    },
  });

  const updateOffersMutation = useMutation({
    mutationFn: (offerIds: string[]) => {
      // Get current config - must preserve all required fields
      const currentConfig = promotion?.currentVersion?.config;
      if (!currentConfig) {
        throw new Error("No current version config found");
      }

      // Build new config with all required fields preserved
      const newConfig: Record<string, unknown> = {
        discountType: currentConfig.discountType,
        discountValue: currentConfig.discountValue,
      };

      // Preserve optional fields if they exist
      if (currentConfig.currency) {
        newConfig.currency = currentConfig.currency;
      }
      if (currentConfig.maxRedemptions) {
        newConfig.maxRedemptions = currentConfig.maxRedemptions;
      }
      if (currentConfig.maxRedemptionsPerCustomer) {
        newConfig.maxRedemptionsPerCustomer =
          currentConfig.maxRedemptionsPerCustomer;
      }
      if (currentConfig.minimumAmount) {
        newConfig.minimumAmount = currentConfig.minimumAmount;
      }
      if (currentConfig.validFrom) {
        newConfig.validFrom = currentConfig.validFrom;
      }
      if (currentConfig.validUntil) {
        newConfig.validUntil = currentConfig.validUntil;
      }
      if (currentConfig.duration) {
        newConfig.duration = currentConfig.duration;
      }
      if (currentConfig.durationInMonths) {
        newConfig.durationInMonths = currentConfig.durationInMonths;
      }

      // Set applicable offers (empty array means all offers)
      if (offerIds.length > 0) {
        newConfig.applicableOfferIds = offerIds;
      }

      return api.promotions.createVersion(id!, newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion", id] });
      setEditingOffers(false);
    },
  });

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (error || !promotion) {
    return <div className="text-red-500">Promotion not found</div>;
  }

  const formatDiscount = (config: PromotionVersion["config"]) => {
    switch (config.discountType) {
      case "percent":
        return `${config.discountValue}% off`;
      case "fixed_amount":
        return `${(config.discountValue / 100).toFixed(2)} ${config.currency?.toUpperCase() || "USD"} off`;
      case "free_trial_days":
        return `${config.discountValue} day free trial`;
    }
  };

  const draftVersion = promotion.versions?.find((v) => v.status === "draft");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{promotion.name}</h1>
          <div className="mt-1 flex items-center gap-3">
            <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded">
              {promotion.code}
            </code>
            <span
              className={`px-2 text-xs font-semibold rounded-full ${
                promotion.status === "active"
                  ? "bg-green-100 text-green-800"
                  : promotion.status === "draft"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
              }`}
            >
              {promotion.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {promotion.status === "active" && (
            <button
              onClick={() => {
                if (
                  confirm("Are you sure you want to archive this promotion?")
                ) {
                  archiveMutation.mutate();
                }
              }}
              disabled={archiveMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => navigate("/promotions")}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      {promotion.description && (
        <p className="text-gray-600 mb-6">{promotion.description}</p>
      )}

      {/* Current Version */}
      {promotion.currentVersion && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Published Version (v{promotion.currentVersion.version})
          </h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Discount</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {formatDiscount(promotion.currentVersion.config)}
              </dd>
            </div>
            {promotion.currentVersion.config.maxRedemptions && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Max Redemptions
                </dt>
                <dd className="text-lg text-gray-900">
                  {promotion.currentVersion.config.maxRedemptions}
                </dd>
              </div>
            )}
            {promotion.currentVersion.config.validFrom && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Valid From
                </dt>
                <dd className="text-gray-900">
                  {new Date(
                    promotion.currentVersion.config.validFrom,
                  ).toLocaleString()}
                </dd>
              </div>
            )}
            {promotion.currentVersion.config.validUntil && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Valid Until
                </dt>
                <dd className="text-gray-900">
                  {new Date(
                    promotion.currentVersion.config.validUntil,
                  ).toLocaleString()}
                </dd>
              </div>
            )}
            {promotion.currentVersion.publishedAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Published At
                </dt>
                <dd className="text-gray-900">
                  {new Date(
                    promotion.currentVersion.publishedAt,
                  ).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Draft Version */}
      {draftVersion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Draft Version (v{draftVersion.version})
            </h2>
            <button
              onClick={() => publishMutation.mutate(draftVersion.id)}
              disabled={publishMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {publishMutation.isPending ? "Publishing..." : "Publish"}
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Discount</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {formatDiscount(draftVersion.config)}
              </dd>
            </div>
            {draftVersion.config.maxRedemptions && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Max Redemptions
                </dt>
                <dd className="text-lg text-gray-900">
                  {draftVersion.config.maxRedemptions}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* No versions yet */}
      {!promotion.currentVersion && !draftVersion && (
        <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
          No versions yet. This promotion needs to be published.
        </div>
      )}

      {/* Applicable Offers */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Applicable Offers
            </h2>
            <p className="text-sm text-gray-500">
              {!promotion.currentVersion?.config?.applicableOfferIds ||
              (promotion.currentVersion.config.applicableOfferIds as string[])
                .length === 0
                ? "This promotion applies to all offers"
                : `Restricted to ${(promotion.currentVersion.config.applicableOfferIds as string[]).length} offer(s)`}
            </p>
          </div>
          {!editingOffers && promotion.status === "active" && (
            <button
              onClick={() => {
                // Reset to current selection
                const currentIds =
                  (promotion.currentVersion?.config
                    ?.applicableOfferIds as string[]) ?? [];
                setSelectedOfferIds(currentIds);
                setEditingOffers(true);
              }}
              className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-800"
            >
              Edit
            </button>
          )}
        </div>

        {editingOffers ? (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
              {allOffers.length === 0 ? (
                <div className="text-gray-500 text-sm">
                  No active offers found.
                </div>
              ) : (
                allOffers.map((offer) => (
                  <label
                    key={offer.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOfferIds.includes(offer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOfferIds([...selectedOfferIds, offer.id]);
                        } else {
                          setSelectedOfferIds(
                            selectedOfferIds.filter((id) => id !== offer.id),
                          );
                        }
                      }}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {offer.name}
                      </div>
                      {offer.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {offer.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {selectedOfferIds.length === 0
                  ? "No offers selected (applies to all)"
                  : `${selectedOfferIds.length} offer(s) selected`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingOffers(false)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateOffersMutation.mutate(selectedOfferIds)}
                  disabled={updateOffersMutation.isPending}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateOffersMutation.isPending
                    ? "Saving..."
                    : "Save (creates draft)"}
                </button>
              </div>
            </div>
            {updateOffersMutation.error && (
              <div className="text-sm text-red-600">
                {(updateOffersMutation.error as Error).message}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {!promotion.currentVersion?.config?.applicableOfferIds ||
            (promotion.currentVersion.config.applicableOfferIds as string[])
              .length === 0 ? (
              <div className="text-sm text-gray-600 italic">
                All offers are eligible for this promotion.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(
                  promotion.currentVersion.config.applicableOfferIds as string[]
                ).map((offerId) => {
                  const offer = allOffers.find((o) => o.id === offerId);
                  return (
                    <span
                      key={offerId}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                    >
                      {offer?.name ?? offerId.slice(0, 8) + "..."}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Version History */}
      {promotion.versions && promotion.versions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Version History
          </h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Version
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Discount
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {promotion.versions.map((version) => (
                <tr key={version.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    v{version.version}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 text-xs font-semibold rounded-full ${
                        version.status === "published"
                          ? "bg-green-100 text-green-800"
                          : version.status === "draft"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {version.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {formatDiscount(version.config)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(version.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {publishMutation.error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {(publishMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
