import { useState } from "react";
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

// 3. Redirect customer to checkout.sessionUrl
// After payment, check entitlements:
const access = await zentla.customers.checkEntitlement(customerId, 'api_access');
// { featureKey: 'api_access', hasAccess: true }`;

const features = [
  {
    title: "Billing + Entitlements",
    description:
      "One unified system. No more stitching together Stripe + feature flags. Entitlements derived directly from subscriptions.",
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
    title: "Provider Portability",
    description:
      "Switch between Stripe, Zuora, or others without code changes. Never be locked into a single billing provider again.",
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
          d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
        />
      </svg>
    ),
  },
  {
    title: "Self-Hosted Option",
    description:
      "Run on your infrastructure. Own your billing data. No vendor lock-in, full data sovereignty.",
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
];

const faqs = [
  {
    question: "What is Zentla?",
    answer:
      "Zentla is a unified monetization layer that combines billing and entitlements in one system. Unlike using Stripe + a separate feature flag tool, Zentla gives you one API where entitlements are derived directly from subscriptions.",
  },
  {
    question: "How is Zentla different from Chargebee or Stripe Billing?",
    answer:
      "Zentla is provider-agnostic—you can switch between Stripe, Zuora, or other providers without code changes. It also natively integrates entitlements with billing, so you don't need a separate system like Stigg or LaunchDarkly.",
  },
  {
    question: "Can I switch billing providers later?",
    answer:
      "Yes. Zentla abstracts your billing provider, so you can migrate from Stripe to Zuora (or vice versa) without changing your application code. Your offers, entitlements, and customer data stay consistent.",
  },
  {
    question: "Can I self-host Zentla?",
    answer:
      "Yes. Zentla can be deployed on your own infrastructure for full data sovereignty. Perfect for regulated industries or teams that need complete control over their billing data.",
  },
  {
    question: "How do pricing experiments work?",
    answer:
      "Offers in Zentla use immutable versioning. Create a new version of your pricing, publish it, and measure conversion. If it underperforms, instantly rollback to the previous version—no deploys required.",
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
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              The unified monetization layer
              <span className="block text-primary-600">for SaaS</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Entitlements, billing, and pricing experiments—without the vendor
              lock-in. Own your billing. Own your data.
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
              Why teams choose Zentla
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              The last billing migration you'll ever need. From feature flags to
              invoices, one API.
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
