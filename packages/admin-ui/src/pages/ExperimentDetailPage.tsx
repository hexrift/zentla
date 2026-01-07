import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ExperimentVariant } from "../lib/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  running: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  concluded: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-500",
};

export function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAddVariant, setShowAddVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({
    key: "",
    name: "",
    description: "",
    weight: 1,
    isControl: false,
  });

  const { data: experiment, isLoading } = useQuery({
    queryKey: ["experiment", id],
    queryFn: () => api.experiments.get(id!),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ["experiment-stats", id],
    queryFn: () => api.experiments.getStats(id!),
    enabled: !!id && experiment?.status !== "draft",
  });

  const startMutation = useMutation({
    mutationFn: () => api.experiments.start(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiment", id] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.experiments.pause(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiment", id] });
    },
  });

  const concludeMutation = useMutation({
    mutationFn: (winningVariantId?: string) =>
      api.experiments.conclude(id!, winningVariantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiment", id] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.experiments.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiment", id] });
      navigate("/experiments");
    },
  });

  const addVariantMutation = useMutation({
    mutationFn: () => api.experiments.addVariant(id!, variantForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiment", id] });
      setShowAddVariant(false);
      setVariantForm({
        key: "",
        name: "",
        description: "",
        weight: 1,
        isControl: false,
      });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) =>
      api.experiments.deleteVariant(id!, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiment", id] });
    },
  });

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!experiment) {
    return <div className="text-red-500">Experiment not found</div>;
  }

  const canStart =
    (experiment.status === "draft" || experiment.status === "paused") &&
    experiment.variants.length >= 2;
  const canPause = experiment.status === "running";
  const canConclude =
    experiment.status === "running" || experiment.status === "paused";
  const canAddVariants = experiment.status === "draft";

  return (
    <div>
      <div className="mb-8">
        <Link
          to="/experiments"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Experiments
        </Link>

        <div className="flex items-start justify-between mt-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {experiment.name}
              </h1>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[experiment.status]}`}
              >
                {experiment.status}
              </span>
            </div>
            <code className="text-sm text-gray-500 font-mono">
              {experiment.key}
            </code>
            {experiment.description && (
              <p className="text-gray-500 mt-2">{experiment.description}</p>
            )}
          </div>

          <div className="flex gap-2">
            {canStart && (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {startMutation.isPending ? "Starting..." : "Start"}
              </button>
            )}
            {canPause && (
              <button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {pauseMutation.isPending ? "Pausing..." : "Pause"}
              </button>
            )}
            {canConclude && (
              <button
                onClick={() => concludeMutation.mutate(undefined)}
                disabled={concludeMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {concludeMutation.isPending ? "Concluding..." : "Conclude"}
              </button>
            )}
            {experiment.status !== "archived" && (
              <button
                onClick={() => {
                  if (
                    confirm("Are you sure you want to archive this experiment?")
                  ) {
                    archiveMutation.mutate();
                  }
                }}
                disabled={archiveMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Statistics
          </h2>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalAssignments.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Assignments</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalExposures.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Exposures</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalConversions.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Conversions</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">
                {(stats.conversionRate * 100).toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">Conversion Rate</div>
            </div>
          </div>

          {stats.variantStats.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Variant
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Assignments
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Exposures
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Conversions
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Conv. Rate
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.variantStats.map((vs) => (
                  <tr key={vs.variantId}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{vs.variantKey}</span>
                      {vs.isControl && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Control
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {vs.assignments.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {vs.exposures.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {vs.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {(vs.conversionRate * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      ${(vs.totalConversionValue / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Details Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Type</dt>
            <dd className="text-sm font-medium text-gray-900 capitalize">
              {experiment.type}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Traffic Allocation</dt>
            <dd className="text-sm font-medium text-gray-900">
              {experiment.trafficAllocation}%
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(experiment.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Updated</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(experiment.updatedAt).toLocaleString()}
            </dd>
          </div>
          {experiment.startAt && (
            <div>
              <dt className="text-sm text-gray-500">Started At</dt>
              <dd className="text-sm font-medium text-gray-900">
                {new Date(experiment.startAt).toLocaleString()}
              </dd>
            </div>
          )}
          {experiment.winningVariantId && (
            <div>
              <dt className="text-sm text-gray-500">Winning Variant</dt>
              <dd className="text-sm font-medium text-gray-900">
                {experiment.variants.find(
                  (v) => v.id === experiment.winningVariantId,
                )?.name || experiment.winningVariantId}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Variants Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
          {canAddVariants && (
            <button
              onClick={() => setShowAddVariant(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
            >
              Add Variant
            </button>
          )}
        </div>

        {experiment.variants.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No variants yet. Add at least 2 variants to start the experiment.
          </div>
        ) : (
          <div className="space-y-4">
            {experiment.variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                canDelete={canAddVariants}
                onDelete={() => deleteVariantMutation.mutate(variant.id)}
                isWinner={variant.id === experiment.winningVariantId}
                onDeclareWinner={
                  canConclude
                    ? () => concludeMutation.mutate(variant.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* Add Variant Form */}
        {showAddVariant && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Add New Variant
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addVariantMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={variantForm.name}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Treatment A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Key
                  </label>
                  <input
                    type="text"
                    value={variantForm.key}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        key: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                    placeholder="treatment-a"
                    pattern="^[a-z0-9-]+$"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  value={variantForm.description}
                  onChange={(e) =>
                    setVariantForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Optional description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Weight
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={variantForm.weight}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        weight: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Relative weight for traffic distribution
                  </p>
                </div>
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="isControl"
                    checked={variantForm.isControl}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        isControl: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isControl"
                    className="ml-2 text-sm text-gray-700"
                  >
                    This is the control variant
                  </label>
                </div>
              </div>

              {addVariantMutation.error && (
                <div className="text-red-600 text-sm">
                  {(addVariantMutation.error as Error).message}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVariant(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addVariantMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {addVariantMutation.isPending ? "Adding..." : "Add Variant"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Warnings */}
      {experiment.status === "draft" && experiment.variants.length < 2 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-700">
            Add at least 2 variants before starting the experiment.
          </p>
        </div>
      )}
    </div>
  );
}

function VariantCard({
  variant,
  canDelete,
  onDelete,
  isWinner,
  onDeclareWinner,
}: {
  variant: ExperimentVariant;
  canDelete: boolean;
  onDelete: () => void;
  isWinner: boolean;
  onDeclareWinner?: () => void;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${isWinner ? "border-green-500 bg-green-50" : "border-gray-200"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{variant.name}</span>
            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
              {variant.key}
            </code>
            {variant.isControl && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Control
              </span>
            )}
            {isWinner && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                Winner
              </span>
            )}
          </div>
          {variant.description && (
            <p className="text-sm text-gray-500 mt-1">{variant.description}</p>
          )}
          <div className="text-sm text-gray-500 mt-2">
            Weight: {variant.weight}
          </div>
        </div>
        <div className="flex gap-2">
          {onDeclareWinner && !isWinner && (
            <button
              onClick={onDeclareWinner}
              className="text-sm text-green-600 hover:text-green-800"
            >
              Declare Winner
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm("Delete this variant?")) {
                  onDelete();
                }
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
