import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

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
                Default Provider
              </label>
              <select
                defaultValue={(workspace?.defaultProvider as string) ?? 'stripe'}
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="stripe">Stripe</option>
                <option value="zuora">Zuora</option>
              </select>
            </div>
          </div>
        </div>

        {/* Billing Provider Configuration */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Billing Provider
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Stripe Secret Key
              </label>
              <input
                type="password"
                placeholder="sk_..."
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md font-mono"
              />
              <p className="mt-1 text-sm text-gray-500">
                Set via environment variable STRIPE_SECRET_KEY
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Stripe Webhook Secret
              </label>
              <input
                type="password"
                placeholder="whsec_..."
                className="mt-1 block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md font-mono"
              />
              <p className="mt-1 text-sm text-gray-500">
                Set via environment variable STRIPE_WEBHOOK_SECRET
              </p>
            </div>
          </div>
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
