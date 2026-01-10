import { CodeBlock } from "../../components/CodeBlock";
import { SEO } from "../../components/SEO";

export function RefundsPage() {
  return (
    <article className="prose-docs">
      <SEO
        title="Refunds"
        description="Process and manage refunds for invoices and charges. Create full or partial refunds, track refund status, and handle refund webhooks."
        path="/docs/refunds"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Refunds", path: "/docs/refunds" },
        ]}
      />
      <h1>Refunds</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        Process and manage refunds for invoices and charges. Refunds are
        processed through your billing provider and synced back via webhooks.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        Zentla provides a unified API for processing refunds across billing
        providers (Stripe or Zuora). You can:
      </p>
      <ul>
        <li>Create full or partial refunds for invoices</li>
        <li>Refund by charge ID or payment intent ID</li>
        <li>Track refund status and failure reasons</li>
        <li>Receive webhook notifications for refund events</li>
      </ul>

      <h2 id="create-refund">Create a Refund</h2>
      <p>
        Create a refund for an invoice, charge, or payment intent. At least one
        identifier must be provided.
      </p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`# Refund by invoice (full amount)
curl -X POST http://localhost:3002/api/v1/refunds \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"invoiceId": "inv_123"}'

# Partial refund
curl -X POST http://localhost:3002/api/v1/refunds \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "invoiceId": "inv_123",
    "amount": 1000,
    "reason": "requested_by_customer"
  }'

# Refund by charge ID
curl -X POST http://localhost:3002/api/v1/refunds \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"chargeId": "ch_stripe_123"}'`}</CodeBlock>

      <h3>Request Body</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Parameter
              </th>
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Type
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>invoiceId</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">
                Invoice to refund (one of invoiceId, chargeId, or
                paymentIntentId required)
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>chargeId</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">
                Provider charge ID to refund
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>paymentIntentId</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">
                Provider payment intent ID to refund
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>amount</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">number</td>
              <td className="py-2 text-gray-600">
                Amount in cents (optional, defaults to full amount)
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>reason</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">
                duplicate, fraudulent, or requested_by_customer
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="list-refunds">List Refunds</h2>
      <p>Retrieve a paginated list of refunds with optional filters:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl http://localhost:3002/api/v1/refunds \\
  -H "x-api-key: YOUR_API_KEY"

# Filter by status
curl "http://localhost:3002/api/v1/refunds?status=succeeded" \\
  -H "x-api-key: YOUR_API_KEY"

# Filter by customer
curl "http://localhost:3002/api/v1/refunds?customerId=cust_123" \\
  -H "x-api-key: YOUR_API_KEY"

# Filter by invoice
curl "http://localhost:3002/api/v1/refunds?invoiceId=inv_123" \\
  -H "x-api-key: YOUR_API_KEY"`}</CodeBlock>

      <h3>Query Parameters</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Parameter
              </th>
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Type
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>limit</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">number</td>
              <td className="py-2 text-gray-600">
                Max items (default: 20, max: 100)
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>cursor</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">Pagination cursor</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>customerId</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">Filter by customer ID</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>invoiceId</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">Filter by invoice ID</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>status</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">
                pending, succeeded, failed, canceled
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="get-refund">Get Refund Details</h2>
      <p>Retrieve a single refund with customer and invoice details:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl http://localhost:3002/api/v1/refunds/ref_123 \\
  -H "x-api-key: YOUR_API_KEY"`}</CodeBlock>

      <CodeBlock title="Response" language="json">{`{
  "id": "ref_123",
  "customerId": "cust_456",
  "invoiceId": "inv_789",
  "amount": 2900,
  "currency": "usd",
  "status": "succeeded",
  "reason": "requested_by_customer",
  "failureReason": null,
  "provider": "stripe",
  "providerRefundId": "re_1234567890",
  "providerChargeId": "ch_1234567890",
  "createdAt": "2025-01-15T10:30:00Z",
  "customer": {
    "id": "cust_456",
    "email": "customer@example.com",
    "name": "John Doe"
  },
  "invoice": {
    "id": "inv_789",
    "providerInvoiceId": "in_1234567890",
    "total": 2900,
    "currency": "usd"
  }
}`}</CodeBlock>

      <h2 id="refund-statuses">Refund Statuses</h2>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Status
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>pending</code>
              </td>
              <td className="py-2 text-gray-600">
                Refund submitted, awaiting processing
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>succeeded</code>
              </td>
              <td className="py-2 text-gray-600">
                Refund completed successfully
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>failed</code>
              </td>
              <td className="py-2 text-gray-600">
                Refund failed (check failureReason)
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>canceled</code>
              </td>
              <td className="py-2 text-gray-600">Refund was canceled</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="refund-reasons">Refund Reasons</h2>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">
                Reason
              </th>
              <th className="text-left py-2 font-medium text-gray-900">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <code>duplicate</code>
              </td>
              <td className="py-2 text-gray-600">Duplicate charge</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>fraudulent</code>
              </td>
              <td className="py-2 text-gray-600">Charge was fraudulent</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>requested_by_customer</code>
              </td>
              <td className="py-2 text-gray-600">Customer requested refund</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="webhooks">Webhook Events</h2>
      <p>Zentla sends webhook events when refund status changes:</p>

      <h3>refund.created</h3>
      <p>Fired when a new refund is created:</p>
      <CodeBlock title="Payload" language="json">{`{
  "id": "evt_123",
  "type": "refund.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "refund": {
      "id": "ref_123",
      "amount": 2900,
      "currency": "usd",
      "status": "pending",
      "reason": "requested_by_customer"
    }
  }
}`}</CodeBlock>

      <h3>refund.updated</h3>
      <p>
        Fired when a refund status changes (e.g., from pending to succeeded or
        failed):
      </p>
      <CodeBlock title="Payload" language="json">{`{
  "id": "evt_124",
  "type": "refund.updated",
  "timestamp": "2025-01-15T10:35:00Z",
  "data": {
    "refund": {
      "id": "ref_123",
      "status": "succeeded",
      "failureReason": null
    }
  }
}`}</CodeBlock>

      <h2 id="sdk">SDK Usage</h2>
      <CodeBlock
        title="refunds.ts"
        language="typescript"
      >{`import { ZentlaClient } from '@hexrift/zentla-sdk';

const zentla = new ZentlaClient({ apiKey: 'YOUR_API_KEY' });

// Create a full refund
const refund = await zentla.refunds.create({
  invoiceId: 'inv_123',
  reason: 'requested_by_customer'
});

// Create a partial refund
const partialRefund = await zentla.refunds.create({
  invoiceId: 'inv_123',
  amount: 1000, // $10.00 in cents
  reason: 'duplicate'
});

// List refunds
const { data: refunds } = await zentla.refunds.list({
  customerId: 'cust_123',
  status: 'succeeded'
});

// Get refund details
const refundDetails = await zentla.refunds.get('ref_123');`}</CodeBlock>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Related Guides</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="/docs/invoices"
              className="text-primary-600 hover:text-primary-700"
            >
              Invoices →
            </a>
            <span className="text-gray-500 ml-2">View and manage invoices</span>
          </li>
          <li>
            <a
              href="/docs/webhooks"
              className="text-primary-600 hover:text-primary-700"
            >
              Webhooks →
            </a>
            <span className="text-gray-500 ml-2">Handle refund events</span>
          </li>
        </ul>
      </div>
    </article>
  );
}
