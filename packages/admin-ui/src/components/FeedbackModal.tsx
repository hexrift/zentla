import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;

async function submitFeedback(data: {
  type: string;
  title: string;
  description: string;
}): Promise<{ success: boolean }> {
  const token = localStorage.getItem("relay_session_token");
  const response = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Failed to submit feedback" }));
    throw new Error(
      error.error?.message || error.message || "Failed to submit feedback",
    );
  }

  const json = await response.json();
  return json.data || json;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<"bug" | "feature" | "other">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      setSubmitted(true);
      setTitle("");
      setDescription("");
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    mutation.mutate({ type, title, description });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-gray-900/50 transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform rounded-xl bg-white shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Send Feedback
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          {submitted ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Thank you!
              </h3>
              <p className="text-sm text-gray-500">
                Your feedback has been submitted.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "bug", label: "Bug Report" },
                    { value: "feature", label: "Feature Request" },
                    { value: "other", label: "Other" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setType(option.value as typeof type)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        type === option.value
                          ? "bg-purple-50 border-purple-300 text-purple-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="feedback-title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Title
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === "bug"
                      ? "Brief description of the issue"
                      : type === "feature"
                        ? "What feature would you like?"
                        : "Subject"
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="feedback-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="feedback-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    type === "bug"
                      ? "Steps to reproduce, expected behavior, what happened instead..."
                      : type === "feature"
                        ? "Describe the feature and how it would help you..."
                        : "Tell us more..."
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  required
                />
              </div>

              {/* Error */}
              {mutation.isError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                  {(mutation.error as Error).message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    mutation.isPending || !title.trim() || !description.trim()
                  }
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
