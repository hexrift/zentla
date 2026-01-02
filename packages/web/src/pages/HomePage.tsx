import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";

const API_DOCS_URL =
  import.meta.env.VITE_API_DOCS_URL || "http://localhost:3002/docs";

const codeExample = `// 1. Create an offer
const offer = await zentla.offers.create({
  name: 'Pro Offer',
  config: {
    pricing: { model: 'flat', amount: 2900, currency: 'USD', interval: 'month' },
    entitlements: [
      { featureKey: 'seats', value: 10, valueType: 'number' },
      { featureKey: 'api_access', value: true, valueType: 'boolean' }
    ]
  }
});

// 2. Create a checkout session
const checkout = await zentla.checkout.createSession({
  offerId: offer.id,
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/cancel'
});

// 3. Redirect customer to checkout.url
// After payment, check entitlements:
const access = await zentla.customers.checkEntitlement(customerId, 'api_access');
// { featureKey: 'api_access', hasAccess: true }`;

const features = [
  {
    title: "Offers & Versioning",
    description:
      "Create pricing plans with immutable versions. Publish, rollback, or schedule changes with confidence.",
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
          d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
        />
      </svg>
    ),
  },
  {
    title: "Checkout",
    description:
      "Hosted or headless checkout flows. Support for trials, promotions, and metadata tracking.",
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
  {
    title: "Entitlements",
    description:
      "Define features and quotas per plan. Query access at runtime with a simple API call.",
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
    title: "Webhooks",
    description:
      "Receive real-time events for subscriptions, payments, and entitlement changes.",
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
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
];

export function HomePage() {
  return (
    <div>
      <SEO path="/" />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Subscription management
              <span className="block text-primary-600">for modern apps</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Zentla manages offers, customers, entitlements, and checkouts.
              Connect to Stripe with a simple API.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/docs/quickstart"
                className="btn-primary text-base px-6 py-3 w-full sm:w-auto"
              >
                Get Started
              </Link>
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener"
                className="btn-secondary text-base px-6 py-3 w-full sm:w-auto"
              >
                API Reference
              </a>
            </div>
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
              Create offers, generate checkout links, and query entitlements in
              just a few lines of code.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <pre className="code-block text-xs sm:text-sm overflow-x-auto">
              <code>{codeExample}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              How it works
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              Get up and running in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Create an Offer
              </h3>
              <p className="text-sm text-gray-600">
                Define your pricing, trial periods, and feature entitlements.
                Version and publish when ready.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Generate Checkout
              </h3>
              <p className="text-sm text-gray-600">
                Create hosted or headless checkout sessions. Apply promotions
                and track metadata.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Query Entitlements
              </h3>
              <p className="text-sm text-gray-600">
                Check feature access in real-time. Gate features based on
                subscription status.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Everything you need
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              A complete subscription management layer between your app and
              billing providers.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
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
              Connect Zentla to your existing payment infrastructure
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
              <span className="mt-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Available
              </span>
            </a>
            {/* Zuora - Official logo */}
            <a
              href="https://www.zuora.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center opacity-60 group"
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
              <span className="mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                Coming Soon
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Follow our quickstart guide to set up offers, checkout, and
            entitlements in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/docs/quickstart"
              className="btn-primary text-base px-8 py-3"
            >
              Start Building
            </Link>
            <Link to="/contact" className="btn-secondary text-base px-8 py-3">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
