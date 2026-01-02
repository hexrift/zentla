import { CodeBlock } from "../../components/CodeBlock";
import { SEO } from "../../components/SEO";

const API_BASE = "http://localhost:3002/api/v1";

export function ExamplePage() {
  return (
    <article className="prose-docs">
      <SEO
        title="End-to-End Example"
        description="A complete walkthrough of the Zentla subscription lifecycle: from creating an offer to handling webhooks when a customer subscribes."
        path="/docs/example"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Example", path: "/docs/example" },
        ]}
      />
      <h1>End-to-End Example</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        A complete walkthrough of the Zentla subscription lifecycle: from
        creating an offer to handling webhooks when a customer subscribes.
      </p>

      <div className="not-prose mb-8 p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <p className="text-sm text-primary-800">
          <strong>Golden Path:</strong> This example demonstrates the most
          common flow. Copy these snippets and adapt them to your application.
        </p>
      </div>

      <h2 id="scenario">Scenario</h2>
      <p>We'll build a complete subscription flow for a SaaS app with:</p>
      <ul>
        <li>A "Pro" offer at $29/month with a 14-day trial</li>
        <li>Access to 5 seats and API access</li>
        <li>A 20% launch discount</li>
        <li>Webhook handling for subscription events</li>
      </ul>

      <h2 id="step-1-setup">Step 1: Initial Setup</h2>

      <h3>Create Features</h3>
      <p>Define the features your offers will include:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`# Create the "seats" feature (numeric limit)
curl -X POST ${API_BASE}/features \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $API_KEY" \\
  -d '{
    "key": "seats",
    "name": "Team Seats",
    "description": "Number of team members allowed",
    "type": "numeric"
  }'

# Create the "api_access" feature (boolean flag)
curl -X POST ${API_BASE}/features \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $API_KEY" \\
  -d '{
    "key": "api_access",
    "name": "API Access",
    "description": "Access to REST API",
    "type": "boolean"
  }'`}</CodeBlock>

      <h3>Create a Promotion</h3>
      <p>Set up the launch discount:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST ${API_BASE}/promotions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $API_KEY" \\
  -d '{
    "name": "Launch Discount",
    "code": "LAUNCH20",
    "discountType": "percent",
    "discountValue": 20,
    "maxRedemptions": 100,
    "expiresAt": "2025-06-01T00:00:00Z"
  }'`}</CodeBlock>

      <h2 id="step-2-offer">Step 2: Create and Publish Offer</h2>
      <CodeBlock title="Terminal" language="bash">{`# Create the Pro Offer offer
curl -X POST ${API_BASE}/offers \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $API_KEY" \\
  -d '{
    "name": "Pro Offer",
    "description": "Everything you need to scale your business",
    "config": {
      "pricing": {
        "model": "flat",
        "amount": 2900,
        "currency": "USD",
        "interval": "month"
      },
      "trial": {
        "days": 14
      },
      "entitlements": [
        { "featureKey": "seats", "value": 5, "valueType": "number" },
        { "featureKey": "api_access", "value": true, "valueType": "boolean" }
      ]
    },
    "metadata": {
      "campaign": "launch_2025",
      "tier": "pro"
    }
  }'

# Save the offer ID from the response
OFFER_ID="offer_..."

# Publish the offer
curl -X POST ${API_BASE}/offers/$OFFER_ID/publish \\
  -H "x-api-key: $API_KEY"`}</CodeBlock>

      <h2 id="step-3-webhook">Step 3: Set Up Webhook Endpoint</h2>
      <p>Register your webhook endpoint to receive events:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST ${API_BASE}/webhook-endpoints \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $API_KEY" \\
  -d '{
    "url": "https://yourapp.com/webhooks/zentla",
    "events": [
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "invoice.paid",
      "invoice.payment_failed",
      "entitlement.granted",
      "entitlement.revoked"
    ]
  }'

# Save the webhook secret from response
WEBHOOK_SECRET="whsec_..."`}</CodeBlock>

      <h2 id="step-4-backend">Step 4: Backend Integration</h2>
      <p>
        Here's a Node.js/Express backend that handles the subscription flow:
      </p>
      <CodeBlock title="server.js" language="javascript">{`// server.js
import express from 'express';
import crypto from 'crypto';

const app = express();
const API_BASE = '${API_BASE}';
const API_KEY = process.env.ZENTLA_API_KEY;
const WEBHOOK_SECRET = process.env.ZENTLA_WEBHOOK_SECRET;

// Helper for Zentla API calls
async function zentlaApi(method, path, body) {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Create or get Zentla customer for your user
app.post('/api/subscribe', express.json(), async (req, res) => {
  const { userId, email, name, offerId, promotionCode } = req.body;

  // 1. Create or find customer
  let customer = await zentlaApi('POST', '/customers', {
    email,
    name,
    externalId: userId,  // Your user ID
  });

  // 2. Create checkout session
  const checkout = await zentlaApi('POST', '/checkout/sessions', {
    customerId: customer.id,
    offerId,
    promotionCode,
    successUrl: \`https://yourapp.com/success?session={CHECKOUT_SESSION_ID}\`,
    cancelUrl: 'https://yourapp.com/pricing',
    metadata: {
      userId,
      source: req.headers['x-source'] || 'web',
    },
  });

  res.json({ checkoutUrl: checkout.url });
});

// Check if user has access to a feature
app.get('/api/check-access/:featureKey', async (req, res) => {
  const { featureKey } = req.params;
  const userId = req.user.id;  // From your auth middleware

  // Find customer by externalId
  const customers = await zentlaApi('GET', \`/customers?externalId=\${userId}\`);
  if (!customers.data?.length) {
    return res.json({ hasAccess: false });
  }

  // Check entitlement
  const entitlements = await zentlaApi(
    'GET',
    \`/customers/\${customers.data[0].id}/entitlements\`
  );

  const entitlement = entitlements.entitlements?.find(
    e => e.featureKey === featureKey
  );

  res.json({
    hasAccess: entitlement?.hasAccess || false,
    value: entitlement?.value,
  });
});

// Webhook handler
app.post('/webhooks/zentla', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-zentla-signature'];
  const payload = req.body.toString();

  // Verify signature
  const [timestamp, hash] = signature.split(',');
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(\`\${timestamp}.\${payload}\`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);
  console.log('Received event:', event.type, event.id);

  // Handle events
  switch (event.type) {
    case 'subscription.created':
      // Provision access for user
      const { customerId, metadata } = event.data.subscription;
      console.log(\`New subscription for customer \${customerId}\`);
      // Update your database, send welcome email, etc.
      break;

    case 'subscription.canceled':
      // Revoke access
      console.log(\`Subscription canceled for \${event.data.subscription.customerId}\`);
      break;

    case 'invoice.payment_failed':
      // Notify user about payment issue
      console.log(\`Payment failed for \${event.data.invoice.customerId}\`);
      break;

    case 'entitlement.granted':
      // Update local permissions cache
      const { featureKey, value } = event.data;
      console.log(\`Entitlement granted: \${featureKey} = \${value}\`);
      break;
  }

  res.status(200).send('OK');
});

app.listen(3000, () => console.log('Server running on :3000'));`}</CodeBlock>

      <h2 id="step-5-frontend">Step 5: Frontend Integration</h2>
      <p>React component for the pricing page:</p>
      <CodeBlock title="PricingPage.tsx" language="tsx">{`// PricingPage.tsx
import { useState, useEffect } from 'react';

const OFFER_ID = 'offer_...';  // Your Pro Offer offer ID

export function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  const handleSubscribe = async () => {
    setLoading(true);

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        offerId: OFFER_ID,
        promotionCode: promoCode || undefined,
      }),
    });

    const { checkoutUrl } = await res.json();
    window.location.href = checkoutUrl;
  };

  return (
    <div className="pricing-card">
      <h2>Pro Offer</h2>
      <p className="price">$29/month</p>
      <p className="trial">14-day free trial</p>

      <ul className="features">
        <li>5 team seats</li>
        <li>Full API access</li>
        <li>Priority support</li>
      </ul>

      <input
        type="text"
        placeholder="Promo code (optional)"
        value={promoCode}
        onChange={e => setPromoCode(e.target.value)}
      />

      <button onClick={handleSubscribe} disabled={loading}>
        {loading ? 'Loading...' : 'Start Free Trial'}
      </button>
    </div>
  );
}

// FeatureGate component for access control
export function FeatureGate({ feature, children, fallback }) {
  const [hasAccess, setHasAccess] = useState(null);

  useEffect(() => {
    fetch(\`/api/check-access/\${feature}\`)
      .then(res => res.json())
      .then(data => setHasAccess(data.hasAccess));
  }, [feature]);

  if (hasAccess === null) return null;
  return hasAccess ? children : fallback;
}

// Usage
function App() {
  return (
    <FeatureGate
      feature="api_access"
      fallback={<UpgradePrompt />}
    >
      <ApiDashboard />
    </FeatureGate>
  );
}`}</CodeBlock>

      <h2 id="step-6-testing">Step 6: Testing the Flow</h2>
      <ol>
        <li>
          <strong>Start your servers</strong>
          <CodeBlock title="Terminal" language="bash">{`# Terminal 1: Zentla API
cd packages/api && yarn dev

# Terminal 2: Your backend
node server.js

# Terminal 3: ngrok for webhooks
ngrok http 3000`}</CodeBlock>
        </li>
        <li>
          <strong>Update webhook URL</strong> with your ngrok URL
        </li>
        <li>
          <strong>Test the checkout flow</strong>
          <ul>
            <li>Go to your pricing page</li>
            <li>Enter promo code "LAUNCH20"</li>
            <li>Click "Start Free Trial"</li>
            <li>
              Complete checkout with test card <code>4242 4242 4242 4242</code>
            </li>
          </ul>
        </li>
        <li>
          <strong>Verify webhook received</strong>
          <CodeBlock
            title="Server logs"
            language="text"
          >{`# You should see in your server logs:
Received event: subscription.created evt_abc123
New subscription for customer cust_xyz789`}</CodeBlock>
        </li>
        <li>
          <strong>Check entitlements</strong>
          <CodeBlock
            title="Terminal"
            language="bash"
          >{`curl http://localhost:3000/api/check-access/api_access
# { "hasAccess": true, "value": true }`}</CodeBlock>
        </li>
      </ol>

      <h2 id="summary">Summary</h2>
      <div className="not-prose my-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">What You Built</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Features for access control</li>
              <li>Offer with pricing, trial, and entitlements</li>
              <li>Promotional discount</li>
              <li>Checkout integration</li>
              <li>Webhook handling</li>
              <li>Entitlement checking</li>
            </ul>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Next Steps</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Add more offers (Free, Enterprise)</li>
              <li>Implement offer upgrades/downgrades</li>
              <li>Add usage-based billing</li>
              <li>Build customer portal</li>
              <li>Set up analytics dashboards</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Related Guides</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="/docs/headless-checkout"
              className="text-primary-600 hover:text-primary-700"
            >
              Headless Checkout →
            </a>
            <span className="text-gray-500 ml-2">Build custom checkout UI</span>
          </li>
          <li>
            <a
              href="/docs/webhooks"
              className="text-primary-600 hover:text-primary-700"
            >
              Webhooks →
            </a>
            <span className="text-gray-500 ml-2">
              Deep dive into event handling
            </span>
          </li>
        </ul>
      </div>
    </article>
  );
}
