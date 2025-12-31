import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export function OfferNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.offers.create({
        name,
        description,
      }),
    onSuccess: (data) => {
      navigate(`/offers/${data.id}`);
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Offer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new offer, then configure pricing and entitlements
        </p>
      </div>

      <div className="p-6 bg-white rounded-lg shadow">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pro Plan"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this offer..."
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              After creating the offer, you'll be able to configure pricing,
              trials, and entitlements on the detail page.
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate("/offers")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name || createMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create Offer"}
            </button>
          </div>

          {createMutation.isError && (
            <p className="text-red-500 text-sm">
              Error: {(createMutation.error as Error).message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
