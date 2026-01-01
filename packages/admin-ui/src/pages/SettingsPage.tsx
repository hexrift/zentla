import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

type BillingProvider = "stripe" | "zuora";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<BillingProvider>("stripe");

  // Stripe config state
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [stripeSaved, setStripeSaved] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem("relay_api_key") ?? "";
    setApiKey(storedKey);
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem("relay_api_key", apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.location.reload();
  };

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => api.workspace.get(),
    enabled: !!localStorage.getItem("relay_api_key"),
  });

  // Get actual provider status from API
  const { data: providerStatus } = useQuery({
    queryKey: ["providerStatus"],
    queryFn: () => api.workspace.getProviderStatus(),
    enabled: !!localStorage.getItem("relay_api_key"),
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
  const isStripeConnected = stripeProvider?.status === "connected";

  // Load Stripe config from workspace settings
  useEffect(() => {
    if (workspace?.settings) {
      const settings = workspace.settings as Record<string, unknown>;
      if (settings.stripeSecretKey) {
        setStripeSecretKey(settings.stripeSecretKey as string);
      }
      if (settings.stripeWebhookSecret) {
        setStripeWebhookSecret(settings.stripeWebhookSecret as string);
      }
    }
  }, [workspace]);

  useEffect(() => {
    if (workspace?.defaultProvider) {
      setSelectedProvider(workspace.defaultProvider as BillingProvider);
    }
  }, [workspace]);

  const updateWorkspaceMutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      api.workspace.update({ settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["providerStatus"] });
      setStripeSaved(true);
      setStripeError(null);
      setTimeout(() => setStripeSaved(false), 3000);
    },
    onError: (error: Error) => {
      setStripeError(error.message);
    },
  });

  const handleSaveStripeConfig = () => {
    updateWorkspaceMutation.mutate({
      stripeSecretKey,
      stripeWebhookSecret,
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        {/* API Key Configuration */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">API Key</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Key for Admin UI
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="relay_test_..."
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md font-mono"
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter your API key to authenticate requests
              </p>
            </div>
            <button onClick={handleSaveApiKey} className="btn-primary">
              {saved ? "Saved!" : "Save API Key"}
            </button>
          </div>
        </div>

        {/* Workspace Settings */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                defaultValue={(workspace?.name as string) ?? ""}
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Billing Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) =>
                  setSelectedProvider(e.target.value as BillingProvider)
                }
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="stripe">Stripe</option>
                <option value="zuora">Zuora</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Select which billing provider to use for this workspace
              </p>
            </div>
          </div>
        </div>

        {/* Provider Configuration */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Provider Configuration
          </h2>

          {selectedProvider === "stripe" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-sm">S</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Stripe</h3>
                  <p className="text-sm text-gray-500">
                    Payment processing and subscriptions
                  </p>
                </div>
                <span
                  className={`ml-auto px-2 py-1 text-xs font-medium rounded-full ${
                    isStripeConnected
                      ? "bg-green-100 text-green-800"
                      : stripeProvider?.status === "error"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {isStripeConnected
                    ? `Connected${stripeProvider?.mode ? ` (${stripeProvider.mode})` : ""}`
                    : stripeProvider?.status === "error"
                      ? "Connection Error"
                      : "Not Configured"}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret Key
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showSecretKey ? "text" : "password"}
                        value={stripeSecretKey}
                        onChange={(e) => setStripeSecretKey(e.target.value)}
                        placeholder="sk_test_..."
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecretKey ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
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
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Find this in your Stripe Dashboard → Developers → API keys
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook Secret
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showWebhookSecret ? "text" : "password"}
                        value={stripeWebhookSecret}
                        onChange={(e) => setStripeWebhookSecret(e.target.value)}
                        placeholder="whsec_..."
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showWebhookSecret ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
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
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    From Stripe CLI:{" "}
                    <code className="bg-gray-200 px-1 rounded">
                      stripe listen --forward-to
                      localhost:3000/api/v1/webhooks/stripe
                    </code>
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSaveStripeConfig}
                    disabled={updateWorkspaceMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {updateWorkspaceMutation.isPending
                      ? "Saving..."
                      : "Save Stripe Config"}
                  </button>
                  {stripeSaved && (
                    <span className="text-sm text-green-600">
                      Saved successfully!
                    </span>
                  )}
                  {stripeError && (
                    <span className="text-sm text-red-600">{stripeError}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedProvider === "zuora" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">Z</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Zuora</h3>
                  <p className="text-sm text-gray-500">
                    Enterprise subscription management
                  </p>
                </div>
                <span className="ml-auto px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                  Not Configured
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Client ID
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-400 flex-1">
                      Not configured
                    </code>
                    <span className="text-xs text-gray-500">
                      Set via ZUORA_CLIENT_ID
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Client Secret
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-400 flex-1">
                      Not configured
                    </code>
                    <span className="text-xs text-gray-500">
                      Set via ZUORA_CLIENT_SECRET
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    API Base URL
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-400 flex-1">
                      Not configured
                    </code>
                    <span className="text-xs text-gray-500">
                      Set via ZUORA_API_URL
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                Configure Zuora credentials in your environment variables to
                enable this provider.
              </p>
            </div>
          )}
        </div>

        {/* Webhook Configuration */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Webhook Retry Policy
          </h2>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Retries
              </label>
              <input
                type="number"
                defaultValue={5}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Initial Delay (ms)
              </label>
              <input
                type="number"
                defaultValue={1000}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Delay (ms)
              </label>
              <input
                type="number"
                defaultValue={300000}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Backoff Multiplier
              </label>
              <input
                type="number"
                defaultValue={2}
                step={0.5}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
