import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;

async function submitFeedback(data: {
  type: string;
  title: string;
  description: string;
}): Promise<{ success: boolean }> {
  const token = localStorage.getItem("zentla_session_token");
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

export function FeedbackPage() {
  const navigate = useNavigate();
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
        navigate("/dashboard");
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    mutation.mutate({ type, title, description });
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Thank you for your feedback!
          </h2>
          <p className="text-gray-500">
            We appreciate you taking the time to help us improve Zentla.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Send Feedback</h1>
          <p className="mt-1 text-sm text-gray-500">
            Help us improve Zentla by sharing your thoughts, reporting bugs, or
            requesting new features.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What type of feedback is this?
            </label>
            <div className="flex gap-3">
              {[
                {
                  value: "bug",
                  label: "Bug Report",
                  description: "Something isn't working",
                },
                {
                  value: "feature",
                  label: "Feature Request",
                  description: "I'd like to see...",
                },
                {
                  value: "other",
                  label: "Other",
                  description: "General feedback",
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value as typeof type)}
                  className={`flex-1 p-4 text-left rounded-lg border-2 transition-colors ${
                    type === option.value
                      ? "bg-purple-50 border-purple-300"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span
                    className={`block text-sm font-medium ${
                      type === option.value
                        ? "text-purple-700"
                        : "text-gray-900"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span
                    className={`block text-xs mt-0.5 ${
                      type === option.value
                        ? "text-purple-600"
                        : "text-gray-500"
                    }`}
                  >
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="feedback-title"
              className="block text-sm font-medium text-gray-700 mb-2"
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
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="feedback-description"
              className="block text-sm font-medium text-gray-700 mb-2"
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
              rows={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Error */}
          {mutation.isError && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg">
              {(mutation.error as Error).message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-2">
            <Link
              to="/dashboard"
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={
                mutation.isPending || !title.trim() || !description.trim()
              }
              className="flex-1 px-6 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
