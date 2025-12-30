import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { clsx } from 'clsx';

interface Event {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: 'pending' | 'processed' | 'failed';
  payload: Record<string, unknown>;
  processedAt: string | null;
  createdAt: string;
}

interface DeadLetterEvent {
  id: string;
  originalEventId: string;
  endpointId: string;
  endpointUrl?: string;
  eventType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function EventsPage() {
  const [tab, setTab] = useState<'events' | 'deadLetter'>('events');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eventsQuery = useQuery({
    queryKey: ['events', statusFilter],
    queryFn: () => api.events.list({ status: statusFilter || undefined, limit: 50 }),
    enabled: tab === 'events',
  });

  const deadLetterQuery = useQuery({
    queryKey: ['deadLetterEvents'],
    queryFn: () => api.events.listDeadLetter({ limit: 50 }),
    enabled: tab === 'deadLetter',
  });

  const events = (eventsQuery.data?.data ?? []) as Event[];
  const deadLetterEvents = (deadLetterQuery.data?.data ?? []) as DeadLetterEvent[];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor webhook events and delivery status
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('events')}
            className={clsx(
              'py-2 px-1 border-b-2 font-medium text-sm',
              tab === 'events'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Outbox Events
          </button>
          <button
            onClick={() => setTab('deadLetter')}
            className={clsx(
              'py-2 px-1 border-b-2 font-medium text-sm',
              tab === 'deadLetter'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Dead Letter Queue
            {deadLetterEvents.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                {deadLetterEvents.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {tab === 'events' && (
        <>
          {/* Filters */}
          <div className="mb-4 flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Events Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {eventsQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No events found
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <>
                      <tr
                        key={event.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {event.eventType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {event.aggregateType}:{event.aggregateId.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={clsx(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              statusColors[event.status]
                            )}
                          >
                            {event.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(event.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.processedAt ? formatDate(event.processedAt) : '-'}
                        </td>
                      </tr>
                      {expandedId === event.id && (
                        <tr key={`${event.id}-expanded`}>
                          <td colSpan={5} className="px-6 py-4 bg-gray-50">
                            <div className="text-sm">
                              <div className="font-medium text-gray-700 mb-2">Payload:</div>
                              <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
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
        </>
      )}

      {tab === 'deadLetter' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failure Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Attempt
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deadLetterQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : deadLetterEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No failed deliveries - all clear!
                  </td>
                </tr>
              ) : (
                deadLetterEvents.map((event) => (
                  <>
                    <tr
                      key={event.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {event.eventType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {event.endpointUrl ?? event.endpointId.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-red-600">
                          {event.failureReason}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.attempts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.lastAttemptAt ? formatDate(event.lastAttemptAt) : '-'}
                      </td>
                    </tr>
                    {expandedId === event.id && (
                      <tr key={`${event.id}-expanded`}>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="text-sm">
                            <div className="font-medium text-gray-700 mb-2">Payload:</div>
                            <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
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
      )}
    </div>
  );
}
