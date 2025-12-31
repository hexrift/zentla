import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { clsx } from "clsx";

interface AuditLog {
  id: string;
  actorType: "api_key" | "user" | "system" | "webhook";
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

interface PaginatedAuditLogs {
  data: AuditLog[];
  hasMore?: boolean;
  nextCursor?: string;
}

const actorTypeLabels: Record<string, string> = {
  api_key: "API Key",
  user: "User",
  system: "System",
  webhook: "Webhook",
};

const actorTypeColors: Record<string, string> = {
  api_key: "bg-blue-100 text-blue-800",
  user: "bg-purple-100 text-purple-800",
  system: "bg-gray-100 text-gray-800",
  webhook: "bg-orange-100 text-orange-800",
};

const actionColors: Record<string, string> = {
  create: "text-green-600",
  update: "text-blue-600",
  delete: "text-red-600",
  publish: "text-purple-600",
  archive: "text-gray-600",
  cancel: "text-orange-600",
};

const PAGE_SIZE = 20;

export function AuditLogsPage() {
  const [actorTypeFilter, setActorTypeFilter] = useState<string>("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auditLogs", actorTypeFilter, resourceTypeFilter, actionFilter],
    queryFn: async () => {
      const result = await api.auditLogs.list({
        actorType: actorTypeFilter || undefined,
        resourceType: resourceTypeFilter || undefined,
        action: actionFilter || undefined,
        limit: PAGE_SIZE,
      });
      // Reset allLogs when filters change
      const paginatedResult = result as PaginatedAuditLogs;
      const logs = paginatedResult.data ?? [];
      setAllLogs(logs);
      setCursor((result as PaginatedAuditLogs).nextCursor);
      return result;
    },
  });

  const hasMore = (data as PaginatedAuditLogs)?.hasMore ?? false;

  const loadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await api.auditLogs.list({
        actorType: actorTypeFilter || undefined,
        resourceType: resourceTypeFilter || undefined,
        action: actionFilter || undefined,
        limit: PAGE_SIZE,
        cursor,
      });
      const paginatedResult = result as PaginatedAuditLogs;
      const newLogs = paginatedResult.data ?? [];
      setAllLogs((prev) => [...prev, ...newLogs]);
      setCursor((result as PaginatedAuditLogs).nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleFilterChange = () => {
    setCursor(undefined);
    setAllLogs([]);
    refetch();
  };

  // Filter logs by search query (client-side)
  const filteredLogs = searchQuery
    ? allLogs.filter(
        (log) =>
          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.actorId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.resourceType.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allLogs;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getActionColor = (action: string) => {
    const baseAction = action.split(".")[0];
    return actionColors[baseAction] ?? "text-gray-600";
  };

  const clearFilters = () => {
    setActorTypeFilter("");
    setResourceTypeFilter("");
    setActionFilter("");
    setSearchQuery("");
    handleFilterChange();
  };

  const hasActiveFilters =
    actorTypeFilter || resourceTypeFilter || actionFilter || searchQuery;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track all changes and actions in your workspace
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by action, resource ID, actor ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={actorTypeFilter}
            onChange={(e) => {
              setActorTypeFilter(e.target.value);
              handleFilterChange();
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Actors</option>
            <option value="api_key">API Key</option>
            <option value="user">User</option>
            <option value="system">System</option>
            <option value="webhook">Webhook</option>
          </select>

          <select
            value={resourceTypeFilter}
            onChange={(e) => {
              setResourceTypeFilter(e.target.value);
              handleFilterChange();
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Resources</option>
            <option value="offer">Offer</option>
            <option value="subscription">Subscription</option>
            <option value="customer">Customer</option>
            <option value="promotion">Promotion</option>
            <option value="webhook_endpoint">Webhook Endpoint</option>
            <option value="api_key">API Key</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              handleFilterChange();
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="publish">Publish</option>
            <option value="archive">Archive</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear filters
            </button>
          )}

          <div className="ml-auto text-sm text-gray-500">
            {filteredLogs.length} {filteredLogs.length === 1 ? "log" : "logs"}
          </div>
        </div>
      </div>

      {/* Scrollable Audit Log Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div
          className="overflow-auto flex-1"
          style={{ maxHeight: "calc(100vh - 320px)" }}
        >
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-500">
                      <svg
                        className="animate-spin h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-12 h-12 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>No audit logs found</span>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="text-purple-600 hover:text-purple-800 text-sm"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        setExpandedId(expandedId === log.id ? null : log.id)
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={clsx(
                            "px-2 py-1 text-xs font-medium rounded-full",
                            actorTypeColors[log.actorType],
                          )}
                        >
                          {actorTypeLabels[log.actorType]}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">
                          {log.actorId.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={clsx(
                            "text-sm font-medium",
                            getActionColor(log.action),
                          )}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {log.resourceType}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          {log.resourceId.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ipAddress ?? "-"}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-gray-700 mb-2">
                                Details
                              </div>
                              <dl className="space-y-1">
                                <div className="flex">
                                  <dt className="text-gray-500 w-24">
                                    Actor ID:
                                  </dt>
                                  <dd className="text-gray-900 font-mono text-xs">
                                    {log.actorId}
                                  </dd>
                                </div>
                                <div className="flex">
                                  <dt className="text-gray-500 w-24">
                                    Resource ID:
                                  </dt>
                                  <dd className="text-gray-900 font-mono text-xs">
                                    {log.resourceId}
                                  </dd>
                                </div>
                                {log.userAgent && (
                                  <div className="flex">
                                    <dt className="text-gray-500 w-24">
                                      User Agent:
                                    </dt>
                                    <dd className="text-gray-900 text-xs truncate max-w-md">
                                      {log.userAgent}
                                    </dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                            {log.changes &&
                              Object.keys(log.changes).length > 0 && (
                                <div>
                                  <div className="font-medium text-gray-700 mb-2">
                                    Changes
                                  </div>
                                  <pre className="bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto text-xs max-h-48 overflow-y-auto">
                                    {JSON.stringify(log.changes, null, 2)}
                                  </pre>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More / Pagination */}
        {(hasMore || cursor) && !searchQuery && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-center">
            <button
              onClick={loadMore}
              disabled={isLoadingMore || !cursor}
              className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoadingMore ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  Load more
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
