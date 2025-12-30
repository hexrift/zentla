import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Promotion, PromotionVersion } from '../lib/types';

export function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: promotion, isLoading, error } = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => api.promotions.get(id!) as Promise<Promotion>,
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: (versionId?: string) => api.promotions.publish(id!, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotion', id] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.promotions.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotion', id] });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (error || !promotion) {
    return <div className="text-red-500">Promotion not found</div>;
  }

  const formatDiscount = (config: PromotionVersion['config']) => {
    switch (config.discountType) {
      case 'percent':
        return `${config.discountValue}% off`;
      case 'fixed_amount':
        return `${(config.discountValue / 100).toFixed(2)} ${config.currency?.toUpperCase() || 'USD'} off`;
      case 'free_trial_days':
        return `${config.discountValue} day free trial`;
    }
  };

  const draftVersion = promotion.versions?.find((v) => v.status === 'draft');

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
                promotion.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {promotion.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {promotion.status === 'active' && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to archive this promotion?')) {
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
            onClick={() => navigate('/promotions')}
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
                <dt className="text-sm font-medium text-gray-500">Valid From</dt>
                <dd className="text-gray-900">
                  {new Date(
                    promotion.currentVersion.config.validFrom
                  ).toLocaleString()}
                </dd>
              </div>
            )}
            {promotion.currentVersion.config.validUntil && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Valid Until</dt>
                <dd className="text-gray-900">
                  {new Date(
                    promotion.currentVersion.config.validUntil
                  ).toLocaleString()}
                </dd>
              </div>
            )}
            {promotion.currentVersion.publishedAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Published At</dt>
                <dd className="text-gray-900">
                  {new Date(
                    promotion.currentVersion.publishedAt
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {publishMutation.isPending ? 'Publishing...' : 'Publish'}
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
                        version.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : version.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
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
