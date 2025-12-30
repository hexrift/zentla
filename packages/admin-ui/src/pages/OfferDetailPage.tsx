import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api } from '../lib/api';

type Tab = 'details' | 'pricing' | 'trials' | 'entitlements' | 'checkout' | 'json';

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const queryClient = useQueryClient();

  const { data: offer, isLoading } = useQuery({
    queryKey: ['offer', id],
    queryFn: () => api.offers.get(id!),
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.offers.publish(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer', id] });
    },
  });

  const tabs: { id: Tab; name: string }[] = [
    { id: 'details', name: 'Details' },
    { id: 'pricing', name: 'Pricing' },
    { id: 'trials', name: 'Trials' },
    { id: 'entitlements', name: 'Entitlements' },
    { id: 'checkout', name: 'Checkout' },
    { id: 'json', name: 'JSON' },
  ];

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!offer) {
    return <div className="text-red-500">Offer not found</div>;
  }

  const currentVersion = offer.currentVersion;
  const draftVersion = offer.versions?.find((v: { status: string }) => v.status === 'draft');

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
              {publishMutation.isPending ? 'Publishing...' : 'Publish Draft'}
            </button>
          )}
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Create Version
          </button>
        </div>
      </div>

      {/* Version info */}
      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="flex items-center space-x-6">
          <div>
            <span className="text-sm text-gray-500">Published Version:</span>
            <span className="ml-2 font-medium">
              {currentVersion ? `v${currentVersion.version}` : 'None'}
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
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'py-4 px-1 text-sm font-medium border-b-2',
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6 bg-white rounded-lg shadow">
        {activeTab === 'details' && <DetailsTab offer={offer} />}
        {activeTab === 'pricing' && <PricingTab offer={offer} />}
        {activeTab === 'trials' && <TrialsTab offer={offer} />}
        {activeTab === 'entitlements' && <EntitlementsTab offer={offer} />}
        {activeTab === 'checkout' && <CheckoutTab offer={offer} />}
        {activeTab === 'json' && <JsonTab offer={offer} />}
      </div>
    </div>
  );
}

function DetailsTab({ offer }: { offer: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          defaultValue={offer.name as string}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          defaultValue={(offer.description as string) ?? ''}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>
  );
}

function PricingTab({ offer }: { offer: Record<string, unknown> }) {
  const config = (offer.currentVersion as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const pricing = config?.pricing as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Pricing Model</label>
          <select
            defaultValue={(pricing?.model as string) ?? 'flat'}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="flat">Flat</option>
            <option value="per_unit">Per Unit</option>
            <option value="tiered">Tiered</option>
            <option value="volume">Volume</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Currency</label>
          <input
            type="text"
            defaultValue={(pricing?.currency as string) ?? 'USD'}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount (cents)</label>
          <input
            type="number"
            defaultValue={(pricing?.amount as number) ?? 0}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Billing Interval</label>
          <select
            defaultValue={(pricing?.interval as string) ?? 'month'}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function TrialsTab({ offer }: { offer: Record<string, unknown> }) {
  const config = (offer.currentVersion as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const trial = config?.trial as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <label className="block text-sm font-medium text-gray-700">Enable Trial</label>
        <input type="checkbox" defaultChecked={!!trial} className="rounded" />
      </div>
      {trial && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Trial Days</label>
            <input
              type="number"
              defaultValue={(trial.days as number) ?? 14}
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div className="flex items-center space-x-4">
            <label className="block text-sm font-medium text-gray-700">
              Require Payment Method
            </label>
            <input
              type="checkbox"
              defaultChecked={(trial.requirePaymentMethod as boolean) ?? false}
              className="rounded"
            />
          </div>
        </>
      )}
    </div>
  );
}

function EntitlementsTab({ offer }: { offer: Record<string, unknown> }) {
  const config = (offer.currentVersion as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const entitlements = (config?.entitlements as Array<Record<string, unknown>>) ?? [];

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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {entitlements.map((e, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-sm text-gray-900">{e.featureKey as string}</td>
              <td className="px-4 py-2 text-sm text-gray-500">{String(e.value)}</td>
              <td className="px-4 py-2 text-sm text-gray-500">{e.valueType as string}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="text-sm text-purple-600 hover:text-purple-800">
        + Add Entitlement
      </button>
    </div>
  );
}

function CheckoutTab({ offer }: { offer: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);

  const currentVersion = offer.currentVersion as Record<string, unknown> | undefined;
  const hasPublishedVersion = !!currentVersion;

  // Generate the API endpoint for creating checkout sessions
  const baseUrl = window.location.origin;
  const apiEndpoint = `${baseUrl}/api/v1/checkout/sessions`;

  const curlExample = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "offerId": "${offer.id}",
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"
  }'`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreviewCheckout = async () => {
    setIsCreating(true);
    try {
      // Use http://localhost URLs for local dev, which IsUrl() accepts
      const baseUrl = window.location.origin;
      const response = await api.checkout.createSession({
        offerId: offer.id as string,
        successUrl: `${baseUrl}/checkouts`,
        cancelUrl: `${baseUrl}/checkouts`,
      });
      if (response.url) {
        setSessionUrl(response.url);
        // Open in new tab
        window.open(response.url, '_blank');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create checkout session:', errorMessage);
      alert(`Failed to create checkout session: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Preview Checkout */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Preview Checkout</h3>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-amber-700">Test Mode</span>
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
            <button
              onClick={handlePreviewCheckout}
              disabled={isCreating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview Checkout
                </>
              )}
            </button>

            {sessionUrl && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last created session:</span>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Generate Checkout Link</h3>
        <p className="text-sm text-gray-500 mb-4">
          Use the API to create hosted checkout sessions for your customers
        </p>

        <div className="space-y-4">
          {/* API Endpoint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Endpoint</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800">
                POST {apiEndpoint}
              </code>
              <button
                onClick={() => handleCopy(`POST ${apiEndpoint}`)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Curl Example */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Example Request</label>
            <div className="relative">
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
                {curlExample}
              </pre>
              <button
                onClick={() => handleCopy(curlExample)}
                className="absolute top-2 right-2 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Quick Reference */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Required Parameters</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">offerId</code>
                <span className="text-gray-600">The offer ID: <code className="text-purple-600">{offer.id as string}</code></span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">successUrl</code>
                <span className="text-gray-600">URL to redirect after successful payment</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">cancelUrl</code>
                <span className="text-gray-600">URL to redirect if customer cancels</span>
              </div>
            </div>

            <h4 className="text-sm font-medium text-gray-700 mt-4 mb-3">Optional Parameters</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">customerId</code>
                <span className="text-gray-600">Existing customer ID</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">customerEmail</code>
                <span className="text-gray-600">Pre-fill customer email</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">promotionCode</code>
                <span className="text-gray-600">Apply a promotion code</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">metadata</code>
                <span className="text-gray-600">Custom key-value metadata</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      {currentVersion && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Version Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Offer ID:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{offer.id as string}</code>
            </div>
            <div>
              <span className="text-gray-500">Version:</span>
              <span className="ml-2 font-medium">v{currentVersion.version as number}</span>
            </div>
            <div>
              <span className="text-gray-500">Version ID:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{currentVersion.id as string}</code>
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

function JsonTab({ offer }: { offer: Record<string, unknown> }) {
  const config = (offer.currentVersion as Record<string, unknown>)?.config;

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
