import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function ExperimentNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    key: "",
    name: "",
    description: "",
    type: "feature" as "feature" | "pricing" | "ui" | "funnel",
    trafficAllocation: 100,
  });

  const createMutation = useMutation({
    mutationFn: () => api.experiments.create(formData),
    onSuccess: (experiment) => {
      queryClient.invalidateQueries({ queryKey: ["experiments"] });
      navigate(`/experiments/${experiment.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const generateKey = () => {
    const key = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setFormData((prev) => ({ ...prev, key }));
  };

  return (
    <div className="max-w-2xl">
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
        <h1 className="text-2xl font-bold text-gray-900 mt-4">
          Create Experiment
        </h1>
        <p className="text-gray-500 mt-1">
          Set up a new A/B test to optimize your pricing, features, or UI.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
              }}
              onBlur={() => {
                if (!formData.key && formData.name) {
                  generateKey();
                }
              }}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Pricing Page V2 Test"
              required
            />
          </div>

          <div>
            <label
              htmlFor="key"
              className="block text-sm font-medium text-gray-700"
            >
              Key
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                id="key"
                value={formData.key}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, key: e.target.value }))
                }
                className="block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                placeholder="pricing-page-v2"
                pattern="^[a-z0-9-]+$"
                required
              />
              <button
                type="button"
                onClick={generateKey}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Generate
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Lowercase letters, numbers, and hyphens only. Used in code.
            </p>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Testing new pricing page layout to improve conversion..."
            />
          </div>

          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700"
            >
              Experiment Type
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  type: e.target.value as typeof formData.type,
                }))
              }
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="feature">Feature - Test feature variations</option>
              <option value="pricing">Pricing - Test pricing strategies</option>
              <option value="ui">UI - Test visual/layout changes</option>
              <option value="funnel">Funnel - Test conversion flows</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="trafficAllocation"
              className="block text-sm font-medium text-gray-700"
            >
              Traffic Allocation
            </label>
            <div className="mt-1 flex items-center gap-4">
              <input
                type="range"
                id="trafficAllocation"
                min="1"
                max="100"
                value={formData.trafficAllocation}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    trafficAllocation: parseInt(e.target.value),
                  }))
                }
                className="block w-full"
              />
              <span className="text-sm font-medium text-gray-900 w-12">
                {formData.trafficAllocation}%
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Percentage of eligible traffic to include in this experiment.
            </p>
          </div>
        </div>

        {createMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {(createMutation.error as Error).message}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            to="/experiments"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Experiment"}
          </button>
        </div>
      </form>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-blue-800">Next steps</h3>
        <p className="mt-1 text-sm text-blue-700">
          After creating the experiment, you'll need to add at least 2 variants
          before you can start it. One variant should be marked as the control.
        </p>
      </div>
    </div>
  );
}
