import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WebhookEndpoint } from '../lib/types';

export function WebhooksPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.webhooks.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Webhook Endpoints</h1>
        <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          Add Endpoint
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">Error loading webhooks</div>
      ) : (
        <div className="space-y-4">
          {data?.data?.map((endpoint: WebhookEndpoint) => (
            <div key={endpoint.id} className="p-4 bg-white rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-gray-900">
                      {endpoint.url}
                    </span>
                    <span
                      className={`px-2 text-xs font-semibold rounded-full ${
                        endpoint.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {endpoint.status}
                    </span>
                  </div>
                  {endpoint.description && (
                    <p className="mt-1 text-sm text-gray-500">{endpoint.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {endpoint.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(endpoint.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
