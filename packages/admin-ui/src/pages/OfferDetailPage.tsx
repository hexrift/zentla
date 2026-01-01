import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api } from "../lib/api";
import type { Offer } from "../lib/types";

type Tab =
  | "details"
  | "pricing"
  | "trials"
  | "entitlements"
  | "checkout"
  | "json";

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "details";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Update tab if URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") as Tab;
    if (
      tabFromUrl &&
      [
        "details",
        "pricing",
        "trials",
        "entitlements",
        "checkout",
        "json",
      ].includes(tabFromUrl)
    ) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: offer, isLoading } = useQuery({
    queryKey: ["offer", id],
    queryFn: () => api.offers.get(id!),
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.offers.publish(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer", id] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.offers.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      navigate("/offers");
    },
  });

  const tabs: { id: Tab; name: string }[] = [
    { id: "details", name: "Details" },
    { id: "pricing", name: "Pricing" },
    { id: "trials", name: "Trials" },
    { id: "entitlements", name: "Entitlements" },
    { id: "checkout", name: "Checkout" },
    { id: "json", name: "JSON" },
  ];

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!offer) {
    return <div className="text-red-500">Offer not found</div>;
  }

  const currentVersion = offer.currentVersion;
  const draftVersion = offer.versions?.find((v) => v.status === "draft");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{offer.name}</h1>
          {offer.description && (
            <p className="mt-1 text-sm text-gray-500">{offer.description}</p>
          )}
        </div>
        <div className="flex space-x-4">
          {draftVersion && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {publishMutation.isPending ? "Publishing..." : "Publish"}
            </button>
          )}
          {offer.status !== "archived" && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Archive Offer
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to archive "{offer.name}"? This will hide it
              from listings and prevent new subscriptions. Existing
              subscriptions will not be affected.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  archiveMutation.mutate();
                  setShowArchiveConfirm(false);
                }}
                disabled={archiveMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {archiveMutation.isPending ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status & Version info */}
      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="flex items-center space-x-6">
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <span
              className={clsx(
                "ml-2 px-2 py-0.5 text-xs font-medium rounded-full",
                offer.status === "active"
                  ? "bg-green-100 text-green-800"
                  : offer.status === "draft"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800",
              )}
            >
              {offer.status}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Published Version:</span>
            <span className="ml-2 font-medium">
              {currentVersion ? `v${currentVersion.version}` : "None"}
            </span>
          </div>
          {draftVersion && (
            <div>
              <span className="text-sm text-gray-500">Draft Version:</span>
              <span className="ml-2 font-medium text-yellow-600">
                v{draftVersion.version}
              </span>
            </div>
          )}
        </div>
        {offer.status === "draft" && !draftVersion && (
          <p className="mt-3 text-sm text-amber-600">
            Configure pricing or entitlements, then publish to activate this
            offer.
          </p>
        )}
        {offer.status === "draft" && draftVersion && (
          <p className="mt-3 text-sm text-amber-600">
            Click "Publish" above to activate this offer.
          </p>
        )}
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
                  ? "border-purple-600 text-purple-600"
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
        {activeTab === "details" && <DetailsTab offer={offer} />}
        {activeTab === "pricing" && <PricingTab offer={offer} />}
        {activeTab === "trials" && <TrialsTab offer={offer} />}
        {activeTab === "entitlements" && <EntitlementsTab offer={offer} />}
        {activeTab === "checkout" && <CheckoutTab offer={offer} />}
        {activeTab === "json" && <JsonTab offer={offer} />}
      </div>
    </div>
  );
}

function DetailsTab({ offer }: { offer: Offer }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          defaultValue={offer.name}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          defaultValue={offer.description ?? ""}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>
  );
}

function PricingTab({ offer }: { offer: Offer }) {
  const queryClient = useQueryClient();
  // Use draft version if available, otherwise current version
  const draftVersion = offer.versions?.find((v) => v.status === "draft");
  const activeVersion = draftVersion ?? offer.currentVersion;
  const config = activeVersion?.config;
  const existingPricing = config?.pricing;

  const [pricing, setPricing] = useState<{
    model: "flat" | "per_unit" | "tiered" | "volume";
    currency: string;
    amount: number;
    interval: "day" | "week" | "month" | "year";
    intervalCount: number;
  }>({
    model: existingPricing?.model ?? "flat",
    currency: existingPricing?.currency ?? "USD",
    amount: existingPricing?.amount ?? 0,
    interval: existingPricing?.interval ?? "month",
    intervalCount:
      ((existingPricing as Record<string, unknown>)?.intervalCount as number) ??
      1,
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateDraftMutation = useMutation({
    mutationFn: (newConfig: Record<string, unknown>) =>
      api.offers.updateDraft(offer.id, newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer", offer.id] });
      setSuccessMessage("Pricing saved to draft");
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleSavePricing = () => {
    const newConfig = {
      ...config,
      pricing,
      entitlements: config?.entitlements ?? [],
    };
    updateDraftMutation.mutate(newConfig);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pricing Model
          </label>
          <select
            value={pricing.model}
            onChange={(e) =>
              setPricing({
                ...pricing,
                model: e.target.value as
                  | "flat"
                  | "per_unit"
                  | "tiered"
                  | "volume",
              })
            }
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="flat">Flat</option>
            <option value="per_unit">Per Unit</option>
            <option value="tiered">Tiered</option>
            <option value="volume">Volume</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Currency
          </label>
          <input
            type="text"
            value={pricing.currency}
            onChange={(e) =>
              setPricing({ ...pricing, currency: e.target.value.toUpperCase() })
            }
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Amount (cents)
          </label>
          <input
            type="number"
            value={pricing.amount}
            onChange={(e) =>
              setPricing({ ...pricing, amount: parseInt(e.target.value) || 0 })
            }
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
          <p className="mt-1 text-xs text-gray-500">e.g., 1999 = $19.99</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Billing Interval
          </label>
          <select
            value={pricing.interval}
            onChange={(e) =>
              setPricing({
                ...pricing,
                interval: e.target.value as "day" | "week" | "month" | "year",
              })
            }
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {updateDraftMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">
            Error: {(updateDraftMutation.error as Error).message}
          </p>
        </div>
      )}

      <button
        onClick={handleSavePricing}
        disabled={updateDraftMutation.isPending}
        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
      >
        {updateDraftMutation.isPending ? "Saving..." : "Save Pricing"}
      </button>
    </div>
  );
}

function TrialsTab({ offer }: { offer: Offer }) {
  const config = offer.currentVersion?.config;
  const trial = config?.trial;

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <label className="block text-sm font-medium text-gray-700">
          Enable Trial
        </label>
        <input type="checkbox" defaultChecked={!!trial} className="rounded" />
      </div>
      {trial && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Trial Days
            </label>
            <input
              type="number"
              defaultValue={trial.days ?? 14}
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div className="flex items-center space-x-4">
            <label className="block text-sm font-medium text-gray-700">
              Require Payment Method
            </label>
            <input
              type="checkbox"
              defaultChecked={trial.requirePaymentMethod ?? false}
              className="rounded"
            />
          </div>
        </>
      )}
    </div>
  );
}

function EntitlementsTab({ offer }: { offer: Offer }) {
  const queryClient = useQueryClient();
  // Use draft version if available, otherwise current version
  const draftVersion = offer.versions?.find((v) => v.status === "draft");
  const activeVersion = draftVersion ?? offer.currentVersion;
  const config = activeVersion?.config;
  const entitlements = config?.entitlements ?? [];
  const [isAdding, setIsAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newEntitlement, setNewEntitlement] = useState({
    featureKey: "",
    value: "" as string | number | boolean,
    valueType: "boolean" as "boolean" | "number" | "string",
  });

  const updateDraftMutation = useMutation({
    mutationFn: (newConfig: Record<string, unknown>) =>
      api.offers.updateDraft(offer.id, newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer", offer.id] });
      setIsAdding(false);
      setNewEntitlement({ featureKey: "", value: "", valueType: "boolean" });
      setSuccessMessage("Entitlement saved to draft");
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleAddEntitlement = () => {
    if (!newEntitlement.featureKey) return;

    let parsedValue: string | number | boolean = newEntitlement.value;
    if (newEntitlement.valueType === "boolean") {
      parsedValue =
        newEntitlement.value === "true" || newEntitlement.value === true;
    } else if (newEntitlement.valueType === "number") {
      parsedValue = Number(newEntitlement.value) || 0;
    }

    const updatedEntitlements = [
      ...entitlements,
      {
        featureKey: newEntitlement.featureKey,
        value: parsedValue,
        valueType: newEntitlement.valueType,
      },
    ];

    // Build config with required pricing field
    const newConfig = {
      pricing: config?.pricing ?? {
        model: "flat",
        currency: "USD",
        amount: 0,
        interval: "month",
      },
      ...config,
      entitlements: updatedEntitlements,
    };

    updateDraftMutation.mutate(newConfig);
  };

  const handleRemoveEntitlement = (index: number) => {
    const updatedEntitlements = entitlements.filter((_, i) => i !== index);
    const newConfig = {
      pricing: config?.pricing ?? {
        model: "flat",
        currency: "USD",
        amount: 0,
        interval: "month",
      },
      ...config,
      entitlements: updatedEntitlements,
    };
    updateDraftMutation.mutate(newConfig);
  };

  return (
    <div className="space-y-4">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Feature Key
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Value
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {entitlements.map((e, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-sm text-gray-900">
                {e.featureKey}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500">
                {String(e.value)}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500">{e.valueType}</td>
              <td className="px-4 py-2 text-sm">
                <button
                  onClick={() => handleRemoveEntitlement(i)}
                  className="text-red-600 hover:text-red-800"
                  disabled={updateDraftMutation.isPending}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {entitlements.length === 0 && !isAdding && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-4 text-sm text-gray-500 text-center"
              >
                No entitlements configured
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {isAdding ? (
        <div className="p-4 border border-gray-200 rounded-md space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Feature Key
              </label>
              <input
                type="text"
                value={newEntitlement.featureKey}
                onChange={(e) =>
                  setNewEntitlement({
                    ...newEntitlement,
                    featureKey: e.target.value,
                  })
                }
                placeholder="e.g., api_requests"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                value={newEntitlement.valueType}
                onChange={(e) =>
                  setNewEntitlement({
                    ...newEntitlement,
                    valueType: e.target.value as
                      | "boolean"
                      | "number"
                      | "string",
                    value: e.target.value === "boolean" ? "true" : "",
                  })
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="boolean">Boolean</option>
                <option value="number">Number</option>
                <option value="string">String</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Value
              </label>
              {newEntitlement.valueType === "boolean" ? (
                <select
                  value={String(newEntitlement.value)}
                  onChange={(e) =>
                    setNewEntitlement({
                      ...newEntitlement,
                      value: e.target.value,
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type={
                    newEntitlement.valueType === "number" ? "number" : "text"
                  }
                  value={String(newEntitlement.value)}
                  onChange={(e) =>
                    setNewEntitlement({
                      ...newEntitlement,
                      value: e.target.value,
                    })
                  }
                  placeholder={
                    newEntitlement.valueType === "number" ? "100" : "value"
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewEntitlement({
                  featureKey: "",
                  value: "",
                  valueType: "boolean",
                });
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAddEntitlement}
              disabled={
                !newEntitlement.featureKey || updateDraftMutation.isPending
              }
              className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {updateDraftMutation.isPending ? "Saving..." : "Add"}
            </button>
          </div>
          {updateDraftMutation.isError && (
            <p className="text-red-500 text-sm">
              Error: {(updateDraftMutation.error as Error).message}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          + Add Entitlement
        </button>
      )}
    </div>
  );
}

interface PromotionConfig {
  discountType: string;
  discountValue: number;
  applicableOfferIds?: string[];
}

interface PromotionWithConfig {
  id: string;
  code: string;
  name: string;
  status: string;
  currentVersion?: {
    config: PromotionConfig;
  };
}

function CheckoutTab({ offer }: { offer: Offer }) {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [needsSync, setNeedsSync] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");

  // Fetch promotions that apply to this offer
  const { data: promotionsData } = useQuery({
    queryKey: ["promotions", "for-offer", offer.id],
    queryFn: () => api.promotions.list({ status: "active", limit: 100 }),
  });

  // Filter to promotions applicable to this offer
  const applicablePromotions = (
    (promotionsData?.data as PromotionWithConfig[]) ?? []
  ).filter((promo) => {
    if (promo.status !== "active" || !promo.currentVersion) return false;
    const config = promo.currentVersion.config;
    // If no applicableOfferIds, applies to all offers
    if (!config.applicableOfferIds || config.applicableOfferIds.length === 0)
      return true;
    // Check if this offer is in the list
    return config.applicableOfferIds.includes(offer.id);
  });

  const selectedPromo = applicablePromotions.find(
    (p) => p.id === selectedPromoId,
  );
  const promoCode = selectedPromo?.code ?? "";

  const currentVersion = offer.currentVersion;
  const hasPublishedVersion = !!currentVersion;

  // Generate the API endpoint for creating checkout sessions
  const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const apiEndpoint = `${apiBaseUrl}/api/v1/checkout/sessions`;

  const curlExample = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "offerId": "${offer.id}",
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"${
      promoCode
        ? `,
    "promotionCode": "${promoCode.toUpperCase()}"`
        : ""
    }
  }'`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncToStripe = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await api.offers.sync(offer.id);
      setNeedsSync(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setSyncError(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePreviewCheckout = async () => {
    setIsCreating(true);
    setSyncError(null);
    try {
      // Use http://localhost URLs for local dev, which IsUrl() accepts
      const baseUrl = window.location.origin;
      const response = await api.checkout.createSession({
        offerId: offer.id,
        successUrl: `${baseUrl}/checkouts`,
        cancelUrl: `${baseUrl}/checkouts`,
        ...(promoCode.trim() && {
          promotionCode: promoCode.trim().toUpperCase(),
        }),
      });
      if (response.url) {
        setSessionUrl(response.url);
        setNeedsSync(false);
        // Open in new tab
        window.open(response.url, "_blank");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to create checkout session:", errorMessage);
      // Check if it's a sync issue
      if (
        errorMessage.includes("not synced") ||
        errorMessage.includes("Stripe")
      ) {
        setNeedsSync(true);
        setSyncError(errorMessage);
      } else {
        setSyncError(errorMessage);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Preview Checkout */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Preview Checkout
        </h3>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-amber-700">
              Test Mode
            </span>
          </div>
          <p className="mt-1 text-sm text-amber-600">
            Create a test checkout session to preview the checkout flow
          </p>
        </div>

        {!hasPublishedVersion ? (
          <div className="p-4 bg-gray-100 rounded-lg text-gray-600 text-sm">
            Publish a version of this offer to enable checkout preview
          </div>
        ) : (
          <div className="space-y-4">
            {/* Promotion Dropdown */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-sm">
                <label
                  htmlFor="promotion"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Apply Promotion (optional)
                </label>
                <select
                  id="promotion"
                  value={selectedPromoId}
                  onChange={(e) => setSelectedPromoId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">No promotion</option>
                  {applicablePromotions.map((promo) => {
                    const config = promo.currentVersion?.config;
                    const discountText =
                      config?.discountType === "percent"
                        ? `${config.discountValue}% off`
                        : config?.discountType === "fixed_amount"
                          ? `${(config.discountValue / 100).toFixed(2)} off`
                          : `${config?.discountValue} days trial`;
                    return (
                      <option key={promo.id} value={promo.id}>
                        {promo.code} - {promo.name} ({discountText})
                      </option>
                    );
                  })}
                </select>
                {applicablePromotions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    No active promotions available for this offer
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePreviewCheckout}
                disabled={isCreating || isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {isCreating ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Preview Checkout
                  </>
                )}
              </button>

              {needsSync && (
                <button
                  onClick={handleSyncToStripe}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isSyncing ? "Syncing..." : "Sync to Stripe"}
                </button>
              )}
            </div>

            {syncError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{syncError}</p>
                {needsSync && (
                  <p className="text-sm text-red-600 mt-1">
                    Click "Sync to Stripe" to sync this offer, then try again.
                  </p>
                )}
              </div>
            )}

            {sessionUrl && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Last created session:
                  </span>
                  <a
                    href={sessionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-600 hover:text-purple-800"
                  >
                    Open →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Link Generation */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Generate Checkout Link
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Use the API to create hosted checkout sessions for your customers
        </p>

        <div className="space-y-4">
          {/* API Endpoint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoint
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800">
                POST {apiEndpoint}
              </code>
              <button
                onClick={() => handleCopy(`POST ${apiEndpoint}`)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Curl Example */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Example Request
            </label>
            <div className="relative">
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
                {curlExample}
              </pre>
              <button
                onClick={() => handleCopy(curlExample)}
                className="absolute top-2 right-2 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Quick Reference */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Required Parameters
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  offerId
                </code>
                <span className="text-gray-600">
                  The offer ID:{" "}
                  <code className="text-purple-600">{offer.id}</code>
                </span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  successUrl
                </code>
                <span className="text-gray-600">
                  URL to redirect after successful payment
                </span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  cancelUrl
                </code>
                <span className="text-gray-600">
                  URL to redirect if customer cancels
                </span>
              </div>
            </div>

            <h4 className="text-sm font-medium text-gray-700 mt-4 mb-3">
              Optional Parameters
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  customerId
                </code>
                <span className="text-gray-600">Existing customer ID</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  customerEmail
                </code>
                <span className="text-gray-600">Pre-fill customer email</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  promotionCode
                </code>
                <span className="text-gray-600">Apply a promotion code</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  metadata
                </code>
                <span className="text-gray-600">Custom key-value metadata</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      {currentVersion && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Version Details
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Offer ID:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
                {offer.id}
              </code>
            </div>
            <div>
              <span className="text-gray-500">Version:</span>
              <span className="ml-2 font-medium">
                v{currentVersion.version}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Version ID:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
                {currentVersion.id}
              </code>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Published
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JsonTab({ offer }: { offer: Offer }) {
  const config = offer.currentVersion?.config;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Advanced configuration escape hatch. Edit the raw JSON config directly.
      </p>
      <textarea
        defaultValue={JSON.stringify(config, null, 2)}
        rows={20}
        className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
      />
    </div>
  );
}
