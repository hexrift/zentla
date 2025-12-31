import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: string;
  environment: string;
  lastUsedAt?: string;
  createdAt: string;
}

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: () => api.apiKeys.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; role: string; environment: string }) =>
      api.apiKeys.create(data),
    onSuccess: (result) => {
      setNewKeySecret(result.secret);
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.apiKeys.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <button
          onClick={() =>
            createMutation.mutate({
              name: "New Key",
              role: "admin",
              environment: "test",
            })
          }
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Create Key
        </button>
      </div>

      {/* New key alert */}
      {newKeySecret && (
        <div className="p-4 mb-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="font-medium text-yellow-800">
            Store this secret securely - it won't be shown again!
          </p>
          <code className="block mt-2 p-2 bg-yellow-100 rounded font-mono text-sm break-all">
            {newKeySecret}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKeySecret);
            }}
            className="mt-2 text-sm text-yellow-700 hover:text-yellow-900"
          >
            Copy to clipboard
          </button>
          <button
            onClick={() => setNewKeySecret(null)}
            className="ml-4 text-sm text-yellow-700 hover:text-yellow-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">Error loading API keys</div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Environment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Used
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data as ApiKey[])?.map((key) => (
                <tr key={key.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {key.name}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">
                    {key.keyPrefix}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {key.role}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 text-xs font-semibold rounded-full ${
                        key.environment === "live"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {key.environment}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => revokeMutation.mutate(key.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Revoke
                    </button>
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
