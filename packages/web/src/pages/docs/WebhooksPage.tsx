import { CodeBlock } from "../../components/CodeBlock";
import { SEO } from "../../components/SEO";

export function WebhooksPage() {
  return (
    <article className="prose-docs">
      <SEO
        title="Webhooks"
        description="Receive real-time notifications when subscriptions change, payments succeed or fail, and entitlements are granted or revoked."
        path="/docs/webhooks"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Webhooks", path: "/docs/webhooks" },
        ]}
      />
      <h1>Webhooks</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        Receive real-time notifications when subscriptions change, payments
        succeed or fail, and entitlements are granted or revoked.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        Zentla sends webhook events to your application when important changes
        occur. Use webhooks to:
      </p>
      <ul>
        <li>Provision or deprovision user access</li>
        <li>Update your database when subscriptions change</li>
        <li>Send notifications to customers</li>
        <li>Trigger workflows in external systems (CRM, analytics, etc.)</li>
      </ul>

      <h2 id="setup">Setting Up Webhooks</h2>
      <h3>1. Create an Endpoint</h3>
      <p>Register a webhook endpoint via the API or Dashboard:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/webhook-endpoints \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "url": "https://yourapp.com/webhooks/relay",
    "events": [
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "invoice.paid",
      "invoice.payment_failed"
    ]
  }'

# Response
{
  "id": "we_...",
  "url": "https://yourapp.com/webhooks/relay",
  "events": ["subscription.created", ...],
  "secret": "whsec_...",
  "status": "active"
}`}</CodeBlock>
      <p>
        Save the <code>secret</code> securely—you'll need it to verify
        signatures.
      </p>

      <h3>2. Handle Events</h3>
      <p>Webhook payloads are JSON with a consistent structure:</p>
      <CodeBlock title="Payload structure" language="json">{`{
  "id": "evt_...",
  "type": "subscription.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "subscription": {
      "id": "sub_...",
      "customerId": "cust_...",
      "offerId": "offer_...",
      "status": "active",
      "currentPeriodStart": "2025-01-15T00:00:00Z",
      "currentPeriodEnd": "2025-02-15T00:00:00Z",
      "metadata": {
        "campaign": "launch_2025"
      }
    }
  }
}`}</CodeBlock>

      <h3>3. Verify Signatures</h3>
      <p>Always verify webhook signatures to ensure events are from Zentla:</p>
      <CodeBlock
        title="webhook-handler.ts"
        language="typescript"
      >{`import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const [timestamp, hash] = signature.split(',');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${payload}\`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expected)
  );
}

// Express example
app.post('/webhooks/relay', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-relay-signature'];
  const payload = req.body.toString();

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);
  // Handle event...

  res.status(200).send('OK');
});`}</CodeBlock>

      <h2 id="events">Event Types</h2>
      <p>Zentla sends the following event types:</p>

      <h3>Subscription Events</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Event
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>subscription.created</code>
              </td>
              <td className="py-2 text-gray-600">New subscription started</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>subscription.updated</code>
              </td>
              <td className="py-2 text-gray-600">
                Subscription modified (plan change, etc.)
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>subscription.canceled</code>
              </td>
              <td className="py-2 text-gray-600">Subscription canceled</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>subscription.renewed</code>
              </td>
              <td className="py-2 text-gray-600">
                Subscription renewed for new period
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>subscription.past_due</code>
              </td>
              <td className="py-2 text-gray-600">
                Payment failed, subscription at risk
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Invoice Events</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Event
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>invoice.created</code>
              </td>
              <td className="py-2 text-gray-600">New invoice generated</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>invoice.paid</code>
              </td>
              <td className="py-2 text-gray-600">Payment succeeded</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>invoice.payment_failed</code>
              </td>
              <td className="py-2 text-gray-600">Payment attempt failed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Entitlement Events</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Event
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>entitlement.granted</code>
              </td>
              <td className="py-2 text-gray-600">
                Customer gained access to a feature
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>entitlement.revoked</code>
              </td>
              <td className="py-2 text-gray-600">
                Customer lost access to a feature
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="payload-examples">Payload Examples</h2>

      <h3>subscription.created</h3>
      <CodeBlock title="Event payload" language="json">{`{
  "id": "evt_abc123",
  "type": "subscription.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "subscription": {
      "id": "sub_xyz789",
      "customerId": "cust_def456",
      "offerId": "offer_ghi012",
      "offerVersionId": "ov_jkl345",
      "status": "active",
      "currentPeriodStart": "2025-01-15T00:00:00Z",
      "currentPeriodEnd": "2025-02-15T00:00:00Z",
      "cancelAtPeriodEnd": false,
      "metadata": {
        "campaign": "launch_2025",
        "referrer": "partner_abc"
      }
    },
    "customer": {
      "id": "cust_def456",
      "email": "user@example.com",
      "externalId": "user_123"
    }
  }
}`}</CodeBlock>

      <h3>invoice.payment_failed</h3>
      <CodeBlock title="Event payload" language="json">{`{
  "id": "evt_mno678",
  "type": "invoice.payment_failed",
  "timestamp": "2025-02-15T08:00:00Z",
  "data": {
    "invoice": {
      "id": "inv_pqr901",
      "subscriptionId": "sub_xyz789",
      "customerId": "cust_def456",
      "amount": 2900,
      "currency": "USD",
      "attemptCount": 1,
      "nextAttempt": "2025-02-18T08:00:00Z"
    },
    "error": {
      "code": "card_declined",
      "message": "Your card was declined"
    }
  }
}`}</CodeBlock>

      <h2 id="best-practices">Best Practices</h2>

      <h3>Respond Quickly</h3>
      <p>
        Return a <code>2xx</code> response within 5 seconds. Process events
        asynchronously using a queue if needed.
      </p>

      <h3>Handle Idempotency</h3>
      <p>
        Events may be delivered more than once. Use the <code>id</code> field to
        deduplicate:
      </p>
      <CodeBlock
        title="Idempotency check"
        language="typescript"
      >{`// Store processed event IDs
const processed = await db.processedEvents.findUnique({
  where: { eventId: event.id }
});

if (processed) {
  return res.status(200).send('Already processed');
}

// Process event, then mark as processed
await handleEvent(event);
await db.processedEvents.create({ data: { eventId: event.id } });`}</CodeBlock>

      <h3>Retry Logic</h3>
      <p>Zentla retries failed deliveries with exponential backoff:</p>
      <ul>
        <li>Attempt 1: Immediate</li>
        <li>Attempt 2: After 1 minute</li>
        <li>Attempt 3: After 5 minutes</li>
        <li>Attempt 4: After 30 minutes</li>
        <li>Attempt 5: After 2 hours</li>
      </ul>
      <p>
        After 5 failed attempts, the endpoint is marked as failing and no
        further deliveries are attempted until manually re-enabled.
      </p>

      <h3>Use Metadata</h3>
      <p>
        Metadata from offers and checkout flows propagates to webhook events.
        Use it to correlate events with your internal systems:
      </p>
      <CodeBlock
        title="Using metadata"
        language="typescript"
      >{`// In your webhook handler
const { campaign, utm_source } = event.data.subscription.metadata;

await analytics.track({
  event: 'subscription_created',
  properties: {
    subscriptionId: event.data.subscription.id,
    campaign,
    utm_source,
  }
});`}</CodeBlock>

      <h2 id="testing">Testing Webhooks</h2>
      <p>
        Use tools like{" "}
        <a href="https://ngrok.com" target="_blank" rel="noopener">
          ngrok
        </a>{" "}
        to expose your local server for webhook testing:
      </p>
      <CodeBlock title="Terminal" language="bash">{`# Start ngrok
ngrok http 3000

# Register the ngrok URL as your webhook endpoint
curl -X POST http://localhost:3002/api/v1/webhook-endpoints \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "url": "https://abc123.ngrok.io/webhooks/relay",
    "events": ["*"]
  }'`}</CodeBlock>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Related Guides</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="/docs/quickstart"
              className="text-primary-600 hover:text-primary-700"
            >
              Quickstart →
            </a>
            <span className="text-gray-500 ml-2">
              Set up your first subscription
            </span>
          </li>
          <li>
            <a
              href="/docs/headless-checkout"
              className="text-primary-600 hover:text-primary-700"
            >
              Headless Checkout →
            </a>
            <span className="text-gray-500 ml-2">
              Build custom checkout flows
            </span>
          </li>
        </ul>
      </div>
    </article>
  );
}
