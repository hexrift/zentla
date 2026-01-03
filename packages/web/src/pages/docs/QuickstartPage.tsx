import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";
import { SEO } from "../../components/SEO";

const API_DOCS_URL =
  import.meta.env.VITE_API_DOCS_URL || "http://localhost:3002/docs";

export function QuickstartPage() {
  return (
    <article className="prose-docs">
      <SEO
        title="Quickstart"
        description="Get up and running with Zentla in under 10 minutes. Create offers, generate checkout links, and verify entitlements."
        path="/docs/quickstart"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Quickstart", path: "/docs/quickstart" },
        ]}
      />
      <h1>Quickstart</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        Get up and running with Zentla in under 10 minutes. This guide walks you
        through creating an offer, generating a checkout link, and verifying
        entitlements.
      </p>

      <div className="not-prose mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Beta:</strong> Zentla is in active development. APIs are
          stable but may receive additive changes. Breaking changes will be
          communicated in advance.
        </p>
      </div>

      <h2 id="prerequisites">Prerequisites</h2>
      <ul>
        <li>A Stripe account with API keys</li>
        <li>Node.js 18+ (for SDK usage)</li>
        <li>Your Zentla API key (from the Dashboard)</li>
      </ul>

      <h2 id="step-1-configure-stripe">Step 1: Configure Stripe</h2>
      <p>
        Connect your Stripe account to Zentla. In the Dashboard, navigate to{" "}
        <strong>Settings → Providers</strong> and add your Stripe secret key.
      </p>
      <CodeBlock title=".env" language="bash">{`# Environment variables
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...`}</CodeBlock>

      <h2 id="step-2-create-feature">Step 2: Define a Feature</h2>
      <p>
        Features represent capabilities in your product. Create one via the API:
      </p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/features \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "key": "api_access",
    "name": "API Access",
    "description": "Access to the REST API",
    "type": "boolean"
  }'`}</CodeBlock>

      <h2 id="step-3-create-offer">Step 3: Create an Offer</h2>
      <p>
        Offers bundle pricing and entitlements. Here's a Pro plan with flat-rate
        pricing:
      </p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/offers \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "name": "Pro Offer",
    "config": {
      "pricing": {
        "model": "flat",
        "amount": 2900,
        "currency": "USD",
        "interval": "month"
      },
      "entitlements": [
        { "featureKey": "api_access", "value": true, "valueType": "boolean" },
        { "featureKey": "seats", "value": 10, "valueType": "number" }
      ]
    },
    "metadata": {
      "campaign": "launch_2025",
      "channel": "website"
    }
  }'`}</CodeBlock>

      <h2 id="step-4-publish-offer">Step 4: Publish the Offer</h2>
      <p>Offers must be published before they can be used in checkouts:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/offers/{offerId}/publish \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</CodeBlock>

      <h2 id="step-5-create-customer">Step 5: Create a Customer</h2>
      <p>Customers represent your users. Create one before checkout:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/customers \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "email": "user@example.com",
    "name": "Jane Doe",
    "externalId": "user_123"
  }'`}</CodeBlock>

      <h2 id="step-6-create-checkout">Step 6: Generate a Checkout Link</h2>
      <p>
        Create a checkout session and redirect your user to the hosted payment
        page:
      </p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/checkout/sessions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "customerId": "cust_...",
    "offerId": "offer_...",
    "successUrl": "https://yourapp.com/success",
    "cancelUrl": "https://yourapp.com/cancel"
  }'

# Response includes checkout URL (hosted by your billing provider)
{
  "id": "cs_...",
  "url": "https://checkout.provider.com/...",
  "status": "pending"
}`}</CodeBlock>

      <h2 id="step-7-check-entitlements">Step 7: Check Entitlements</h2>
      <p>After successful payment, verify what the customer has access to:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl http://localhost:3002/api/v1/customers/{customerId}/entitlements \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response
{
  "customerId": "cust_...",
  "entitlements": [
    {
      "featureKey": "api_access",
      "hasAccess": true,
      "value": true,
      "valueType": "boolean",
      "source": "subscription"
    },
    {
      "featureKey": "seats",
      "hasAccess": true,
      "value": 10,
      "valueType": "number",
      "source": "subscription"
    }
  ]
}`}</CodeBlock>

      <h2 id="whats-next">What's Next</h2>
      <ul>
        <li>
          <Link to="/docs/example">End-to-End Example</Link> – Complete
          walkthrough from offer to webhook
        </li>
        <li>
          <Link to="/docs/headless-checkout">Headless Checkout</Link> – Build
          custom checkout flows
        </li>
        <li>
          <Link to="/docs/webhooks">Webhooks</Link> – React to subscription
          events in real-time
        </li>
        <li>
          <a href={API_DOCS_URL} target="_blank" rel="noopener">
            API Reference
          </a>{" "}
          – Full endpoint documentation
        </li>
      </ul>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Need help?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Zentla is in beta. If you run into issues or have feedback, we'd love
          to hear from you.
        </p>
        <Link
          to="/feedback"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Send us feedback →
        </Link>
      </div>
    </article>
  );
}
