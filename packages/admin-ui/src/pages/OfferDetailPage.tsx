import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api } from '../lib/api';

type Tab = 'details' | 'pricing' | 'trials' | 'entitlements' | 'json';

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
                  ? 'border-blue-500 text-blue-600'
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
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          defaultValue={(offer.description as string) ?? ''}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount (cents)</label>
          <input
            type="number"
            defaultValue={(pricing?.amount as number) ?? 0}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Billing Interval</label>
          <select
            defaultValue={(pricing?.interval as string) ?? 'month'}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
      <button className="text-sm text-blue-600 hover:text-blue-800">
        + Add Entitlement
      </button>
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
        className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
