import { useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

interface ContactFormData {
  companyName: string;
  name: string;
  email: string;
  companySize: string;
  message: string;
}

async function submitContact(
  data: ContactFormData,
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/v1/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "contact",
      title: `Contact from ${data.companyName}`,
      description: `Company: ${data.companyName}\nName: ${data.name}\nCompany Size: ${data.companySize}\n\nMessage:\n${data.message}`,
      email: data.email,
    }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Failed to submit contact request" }));
    throw new Error(
      error.error?.message ||
        error.message ||
        "Failed to submit contact request",
    );
  }

  const json = await response.json();
  return json.data || json;
}

const companySizes = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "500+", label: "500+ employees" },
];

export function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    companyName: "",
    name: "",
    email: "",
    companySize: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.companyName.trim() ||
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.message.trim()
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitContact(formData);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit contact request",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
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
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Thanks for reaching out!
          </h2>
          <p className="text-gray-500 mb-6">
            We've received your message and will get back to you within 1-2
            business days.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Contact Sales"
        description="Get in touch with our team to learn how Zentla can help manage your subscriptions."
        path="/contact"
      />
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">Zentla</span>
            </Link>
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Contact Sales
          </h1>
          <p className="text-lg text-gray-500">
            Ready to streamline your subscription management? Let's talk about
            how Zentla can help your business.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Company Name */}
            <div>
              <label
                htmlFor="company-name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Company Name
              </label>
              <input
                id="company-name"
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                placeholder="Your company name"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Name and Email row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Work Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="john@company.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Company Size */}
            <div>
              <label
                htmlFor="company-size"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Company Size
              </label>
              <select
                id="company-size"
                value={formData.companySize}
                onChange={(e) => handleChange("companySize", e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              >
                <option value="">Select company size</option>
                {companySizes.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="contact-message"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                How can we help?
              </label>
              <textarea
                id="contact-message"
                value={formData.message}
                onChange={(e) => handleChange("message", e.target.value)}
                placeholder="Tell us about your subscription management needs, current challenges, or questions about Zentla..."
                rows={5}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-4 pt-2">
              <Link
                to="/"
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !formData.companyName.trim() ||
                  !formData.name.trim() ||
                  !formData.email.trim() ||
                  !formData.message.trim()
                }
                className="flex-1 px-6 py-3 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Trusted by SaaS companies worldwide
          </p>
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
              <span className="text-sm">Enterprise-grade security</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
              <span className="text-sm">Fast integration</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
