import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { clsx } from 'clsx';

interface AuditLog {
  id: string;
  actorType: 'api_key' | 'user' | 'system' | 'webhook';
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const actorTypeLabels: Record<string, string> = {
  api_key: 'API Key',
  user: 'User',
  system: 'System',
  webhook: 'Webhook',
};

const actorTypeColors: Record<string, string> = {
  api_key: 'bg-blue-100 text-blue-800',
  user: 'bg-purple-100 text-purple-800',
  system: 'bg-gray-100 text-gray-800',
  webhook: 'bg-orange-100 text-orange-800',
};

const actionColors: Record<string, string> = {
  create: 'text-green-600',
  update: 'text-blue-600',
  delete: 'text-red-600',
  publish: 'text-purple-600',
  archive: 'text-gray-600',
  cancel: 'text-orange-600',
};

export function AuditLogsPage() {
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', actorTypeFilter, resourceTypeFilter],
    queryFn: () =>
      api.auditLogs.list({
        actorType: actorTypeFilter || undefined,
        resourceType: resourceTypeFilter || undefined,
        limit: 50,
      }),
  });

  const logs = (data?.data ?? []) as AuditLog[];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getActionColor = (action: string) => {
    const baseAction = action.split('.')[0];
    return actionColors[baseAction] ?? 'text-gray-600';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track all changes and actions in your workspace
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <select
          value={actorTypeFilter}
          onChange={(e) => setActorTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Actors</option>
          <option value="api_key">API Key</option>
          <option value="user">User</option>
          <option value="system">System</option>
          <option value="webhook">Webhook</option>
        </select>
        <select
          value={resourceTypeFilter}
          onChange={(e) => setResourceTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Resources</option>
          <option value="offer">Offer</option>
          <option value="subscription">Subscription</option>
          <option value="customer">Customer</option>
          <option value="promotion">Promotion</option>
          <option value="webhook_endpoint">Webhook Endpoint</option>
          <option value="api_key">API Key</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          'px-2 py-1 text-xs font-medium rounded-full',
                          actorTypeColors[log.actorType]
                        )}
                      >
                        {actorTypeLabels[log.actorType]}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {log.actorId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx('text-sm font-medium', getActionColor(log.action))}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{log.resourceType}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        {log.resourceId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress ?? '-'}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-expanded`}>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-gray-700 mb-2">Details</div>
                            <dl className="space-y-1">
                              <div className="flex">
                                <dt className="text-gray-500 w-24">Actor ID:</dt>
                                <dd className="text-gray-900 font-mono text-xs">{log.actorId}</dd>
                              </div>
                              <div className="flex">
                                <dt className="text-gray-500 w-24">Resource ID:</dt>
                                <dd className="text-gray-900 font-mono text-xs">{log.resourceId}</dd>
                              </div>
                              {log.userAgent && (
                                <div className="flex">
                                  <dt className="text-gray-500 w-24">User Agent:</dt>
                                  <dd className="text-gray-900 text-xs truncate max-w-md">
                                    {log.userAgent}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div>
                              <div className="font-medium text-gray-700 mb-2">Changes</div>
                              <pre className="bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto text-xs">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
