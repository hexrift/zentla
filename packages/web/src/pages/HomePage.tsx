import { useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";

const API_DOCS_URL =
  import.meta.env.VITE_API_DOCS_URL || "http://localhost:3002/docs";

const codeExample = `// 1. Create an offer with entitlements
const offer = await zentla.offers.create({
  name: 'Pro Plan',
  config: {
    pricing: { model: 'flat', amount: 2900, currency: 'USD', interval: 'month' },
    entitlements: [
      { featureKey: 'seats', value: 10, valueType: 'number' },
      { featureKey: 'api_access', value: true, valueType: 'boolean' }
    ]
  }
});

// 2. Track usage for usage-based billing
await zentla.usage.ingest({
  customerId: 'cust_123',
  metricKey: 'api_calls',
  quantity: 1
});

// 3. Check entitlements at runtime
const access = await zentla.customers.checkEntitlement(customerId, 'api_access');
// { featureKey: 'api_access', hasAccess: true }`;

const pillars = [
  {
    title: "Entitlements",
    description:
      "Feature access, quotas, and limits derived directly from subscriptions. No more stitching together Stripe + LaunchDarkly.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
        />
      </svg>
    ),
  },
  {
    title: "Usage Metering",
    description:
      "Track millions of events with idempotency. Aggregate usage for billing with sum, max, count, or last value.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    title: "Multi-Provider",
    description:
      "Stripe today, Zuora tomorrow. Switch billing providers without code changes. Never be locked in again.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
    ),
  },
  {
    title: "Revenue Analytics",
    description:
      "Real-time MRR, churn rate, and cohort analysis. Built-in dashboard, no spreadsheets required.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
        />
      </svg>
    ),
  },
];

const features = [
  {
    title: "Pricing Experiments",
    description:
      "A/B test pricing with immutable offer versions. Publish, rollback, or schedule changes without deploys.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
        />
      </svg>
    ),
  },
  {
    title: "Self-Hosted",
    description:
      "Run on your infrastructure. Full data sovereignty. Perfect for regulated industries.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
        />
      </svg>
    ),
  },
  {
    title: "Audit Logging",
    description:
      "Enterprise-grade compliance. Track every action, every change, every API call.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
        />
      </svg>
    ),
  },
  {
    title: "Headless Checkout",
    description:
      "Build custom checkout experiences with our headless API. Full control over UI/UX.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
        />
      </svg>
    ),
  },
];

const faqs = [
  {
    question: "What is Zentla?",
    answer:
      "Zentla is open source billing infrastructure that combines entitlements, usage metering, multi-provider billing, and revenue analytics in one unified API. Think of it as the open source alternative to Stigg, Orb, or Lago.",
  },
  {
    question: "How is Zentla different from Stripe Billing?",
    answer:
      "Stripe Billing ties you to Stripe. Zentla is provider-agnostic—connect Stripe, Zuora, or both. It also adds entitlements (feature gating), usage metering, and revenue analytics that Stripe doesn't provide natively.",
  },
  {
    question: "How is Zentla different from Stigg or Orb?",
    answer:
      "Zentla is fully open source and self-hostable. Stigg focuses on entitlements but lacks usage metering. Orb focuses on usage-based billing but lacks entitlements. Zentla does both, plus multi-provider support and revenue analytics.",
  },
  {
    question: "Can I switch billing providers later?",
    answer:
      "Yes. Zentla abstracts your billing provider, so you can migrate from Stripe to Zuora (or vice versa) without changing your application code. Your offers, entitlements, and customer data stay consistent.",
  },
  {
    question: "Can I self-host Zentla?",
    answer:
      "Yes. Zentla is MIT licensed and can be deployed on your own infrastructure. Run it on Kubernetes, Railway, Render, or any platform that supports Node.js, PostgreSQL, and Redis.",
  },
  {
    question: "What about usage-based billing?",
    answer:
      "Zentla includes a full usage metering system. Ingest events via API, aggregate with flexible strategies (sum, max, count, last), and get real-time usage summaries. Perfect for API calls, compute time, or any metered resource.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900">{question}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-5">
          <p className="text-gray-600">{answer}</p>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  return (
    <div>
      <SEO path="/" />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-sm font-medium text-primary-600 mb-4">
              Open source alternative to Stigg, Orb, and Lago
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Billing
              <span className="block text-primary-600">you control</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Open source entitlements, metering, and billing—without the
              lock-in. Self-host or use our cloud. Switch providers anytime.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/docs/quickstart"
                className="btn-primary text-base px-6 py-3 w-full sm:w-auto"
              >
                Get Started
              </Link>
              <a
                href="https://github.com/hexrift/zentla"
                target="_blank"
                rel="noopener"
                className="btn-secondary text-base px-6 py-3 w-full sm:w-auto inline-flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-16 sm:py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Billing infrastructure is a black hole
            </h2>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
              Every team rebuilds the same billing infrastructure. We built
              Zentla so you don't have to.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-800/50 rounded-lg p-5">
              <div className="text-red-400 font-mono text-sm mb-2">
                // Problem 1
              </div>
              <h3 className="font-semibold mb-1">Entitlements sprawl</h3>
              <p className="text-sm text-gray-400">
                Feature flags, plan limits, and access controls scattered across
                services
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-5">
              <div className="text-red-400 font-mono text-sm mb-2">
                // Problem 2
              </div>
              <h3 className="font-semibold mb-1">Usage tracking pain</h3>
              <p className="text-sm text-gray-400">
                Metering, aggregation, and overage logic built from scratch
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-5">
              <div className="text-red-400 font-mono text-sm mb-2">
                // Problem 3
              </div>
              <h3 className="font-semibold mb-1">Provider lock-in</h3>
              <p className="text-sm text-gray-400">
                Tightly coupled to Stripe, dreading the day you need Zuora
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-5">
              <div className="text-red-400 font-mono text-sm mb-2">
                // Problem 4
              </div>
              <h3 className="font-semibold mb-1">No visibility</h3>
              <p className="text-sm text-gray-400">
                MRR, churn, and cohort metrics buried in spreadsheets
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Four pillars. One API.
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              Everything you need to monetize your product, without the
              infrastructure tax
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
                  {pillar.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {pillar.title}
                </h3>
                <p className="text-sm text-gray-600">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code example */}
      <section className="py-16 sm:py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Simple, powerful API
            </h2>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
              Create offers, track usage, and query entitlements in just a few
              lines of code.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <pre className="code-block text-xs sm:text-sm overflow-x-auto">
              <code>{codeExample}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Why teams choose Zentla
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              The only billing infrastructure that does it all—and it's open
              source
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl shadow-sm border border-gray-200">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-primary-600">
                    Zentla
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-500">
                    Stigg
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-500">
                    Orb
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-500">
                    Stripe
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Open Source
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Self-Hostable
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Entitlements
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-green-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Usage Metering
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-green-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-green-600">
                    &#10003;
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Multi-Provider
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Revenue Analytics
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Pricing Experiments
                  </td>
                  <td className="px-6 py-4 text-center text-primary-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-green-600">
                    &#10003;
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                  <td className="px-6 py-4 text-center text-gray-300">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* More Features */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Everything else you need
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 sm:py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Works with your billing provider
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              Connect today. Switch tomorrow. No code changes required.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {/* Stripe - Official logo */}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center group"
            >
              <div className="h-12 flex items-center">
                <img
                  src="/logos/stripe.svg"
                  alt="Stripe - Payment processing platform"
                  className="h-10 object-contain group-hover:opacity-80 transition-opacity"
                  width="82"
                  height="34"
                  loading="lazy"
                />
              </div>
              <span className="mt-1 px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                Available
              </span>
            </a>
            {/* Zuora - Official logo */}
            <a
              href="https://www.zuora.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center group"
            >
              <div className="h-12 flex items-center">
                <img
                  src="/logos/zuora.svg"
                  alt="Zuora - Subscription management platform"
                  className="h-8 object-contain group-hover:opacity-80 transition-opacity"
                  width="100"
                  height="32"
                  loading="lazy"
                />
              </div>
              <span className="mt-1 px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                Available
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-gray-600">
              Everything you need to know about Zentla
            </p>
          </div>
          <div className="border-t border-gray-200">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === index}
                onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to own your billing infrastructure?
          </h2>
          <p className="text-primary-100 mb-8 max-w-xl mx-auto">
            Deploy in minutes. Migrate from Stripe in hours. No vendor lock-in,
            ever.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/docs/quickstart"
              className="bg-white text-primary-600 hover:bg-primary-50 font-medium px-8 py-3 rounded-lg transition-colors"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/hexrift/zentla"
              target="_blank"
              rel="noopener"
              className="border border-primary-300 text-white hover:bg-primary-500 font-medium px-8 py-3 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
