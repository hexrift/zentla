import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type BillingProvider = 'stripe' | 'zuora';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<BillingProvider>('stripe');

  useEffect(() => {
    const storedKey = localStorage.getItem('relay_api_key') ?? '';
    setApiKey(storedKey);
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem('relay_api_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.location.reload();
  };

  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.workspace.get(),
    enabled: !!localStorage.getItem('relay_api_key'),
  });

  useEffect(() => {
    if (workspace?.defaultProvider) {
      setSelectedProvider(workspace.defaultProvider as BillingProvider);
    }
  }, [workspace]);

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
            <button
              onClick={handleSaveApiKey}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {saved ? 'Saved!' : 'Save API Key'}
            </button>
          </div>
        </div>

        {/* Workspace Settings */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                defaultValue={(workspace?.name as string) ?? ''}
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Billing Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as BillingProvider)}
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

          {selectedProvider === 'stripe' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-sm">S</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Stripe</h3>
                  <p className="text-sm text-gray-500">Payment processing and subscriptions</p>
                </div>
                <span className="ml-auto px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  Connected
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Key</label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-600 flex-1">
                      sk_test_••••••••••••••••
                    </code>
                    <span className="text-xs text-gray-500">Set via STRIPE_SECRET_KEY</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-600 flex-1">
                      whsec_••••••••••••••••
                    </code>
                    <span className="text-xs text-gray-500">Set via STRIPE_WEBHOOK_SECRET</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Webhook Endpoint</label>
                  <div className="mt-1">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-600 block">
                      https://your-domain.com/api/v1/webhooks/stripe
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedProvider === 'zuora' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">Z</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Zuora</h3>
                  <p className="text-sm text-gray-500">Enterprise subscription management</p>
                </div>
                <span className="ml-auto px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                  Not Configured
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client ID</label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-400 flex-1">
                      Not configured
                    </code>
                    <span className="text-xs text-gray-500">Set via ZUORA_CLIENT_ID</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client Secret</label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-400 flex-1">
                      Not configured
                    </code>
                    <span className="text-xs text-gray-500">Set via ZUORA_CLIENT_SECRET</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Base URL</label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-mono text-gray-400 flex-1">
                      Not configured
                    </code>
                    <span className="text-xs text-gray-500">Set via ZUORA_API_URL</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                Configure Zuora credentials in your environment variables to enable this provider.
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
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
