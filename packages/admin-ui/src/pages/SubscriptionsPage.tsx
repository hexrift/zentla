import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Subscription {
  id: string;
  status: string;
  customer: { id: string; email: string; name?: string };
  offer: { id: string; name: string };
  currentPeriodEnd: string;
  createdAt: string;
}

export function SubscriptionsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.subscriptions.list(),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Subscriptions</h1>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">Error loading subscriptions</div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Offer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period End
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.data?.map((sub: Subscription) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {sub.customer.email}
                    </div>
                    {sub.customer.name && (
                      <div className="text-sm text-gray-500">{sub.customer.name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {sub.offer.name}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        sub.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : sub.status === 'trialing'
                          ? 'bg-blue-100 text-blue-800'
                          : sub.status === 'canceled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
