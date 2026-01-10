import { CodeBlock } from "../../components/CodeBlock";
import { SEO } from "../../components/SEO";

export function InvoicesPage() {
  return (
    <article className="prose-docs">
      <SEO
        title="Invoices"
        description="View and manage invoices synced from your billing provider. List invoices, get PDF downloads, void invoices, and retry payments."
        path="/docs/invoices"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "Invoices", path: "/docs/invoices" },
        ]}
      />
      <h1>Invoices</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        View and manage invoices synced from your billing provider. Invoices are
        automatically created when customers are billed for subscriptions.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        Zentla automatically syncs invoices from your billing provider (Stripe
        or Zuora) via webhooks. You can:
      </p>
      <ul>
        <li>List and filter invoices by customer, subscription, or status</li>
        <li>View invoice details including line items</li>
        <li>Download invoice PDFs</li>
        <li>Void unpaid invoices</li>
        <li>Retry failed payments</li>
      </ul>

      <h2 id="list-invoices">List Invoices</h2>
      <p>Retrieve a paginated list of invoices with optional filters:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl http://localhost:3002/api/v1/invoices \\
  -H "x-api-key: YOUR_API_KEY"

# Filter by status
curl "http://localhost:3002/api/v1/invoices?status=open" \\
  -H "x-api-key: YOUR_API_KEY"

# Filter by customer
curl "http://localhost:3002/api/v1/invoices?customerId=cust_123" \\
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
                <code>subscriptionId</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">Filter by subscription ID</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>status</code>
              </td>
              <td className="py-2 pr-4 text-gray-600">string</td>
              <td className="py-2 text-gray-600">
                draft, open, paid, void, uncollectible
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="get-invoice">Get Invoice Details</h2>
      <p>Retrieve a single invoice with line items:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl http://localhost:3002/api/v1/invoices/inv_123 \\
  -H "x-api-key: YOUR_API_KEY"`}</CodeBlock>

      <CodeBlock title="Response" language="json">{`{
  "id": "inv_123",
  "customerId": "cust_456",
  "subscriptionId": "sub_789",
  "amountDue": 2900,
  "amountPaid": 2900,
  "amountRemaining": 0,
  "subtotal": 2900,
  "tax": 0,
  "total": 2900,
  "currency": "usd",
  "status": "paid",
  "periodStart": "2025-01-15T00:00:00Z",
  "periodEnd": "2025-02-15T00:00:00Z",
  "paidAt": "2025-01-15T10:30:00Z",
  "provider": "stripe",
  "providerInvoiceId": "in_1234567890",
  "lineItems": [
    {
      "id": "li_123",
      "description": "Pro Plan (Jan 15 - Feb 15)",
      "quantity": 1,
      "unitAmount": 2900,
      "amount": 2900,
      "currency": "usd"
    }
  ],
  "customer": {
    "id": "cust_456",
    "email": "customer@example.com",
    "name": "John Doe"
  }
}`}</CodeBlock>

      <h2 id="invoice-statuses">Invoice Statuses</h2>
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
                <code>draft</code>
              </td>
              <td className="py-2 text-gray-600">
                Invoice created but not finalized
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>open</code>
              </td>
              <td className="py-2 text-gray-600">
                Invoice sent, awaiting payment
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>paid</code>
              </td>
              <td className="py-2 text-gray-600">Payment received</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>void</code>
              </td>
              <td className="py-2 text-gray-600">Invoice was voided</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <code>uncollectible</code>
              </td>
              <td className="py-2 text-gray-600">
                Marked uncollectible after failed attempts
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="download-pdf">Download Invoice PDF</h2>
      <p>Get a temporary download URL for the invoice PDF:</p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl http://localhost:3002/api/v1/invoices/inv_123/pdf \\
  -H "x-api-key: YOUR_API_KEY"

# Response
{
  "url": "https://pay.stripe.com/invoice/...",
  "expiresAt": "2025-01-15T11:30:00Z"
}`}</CodeBlock>

      <h2 id="void-invoice">Void an Invoice</h2>
      <p>
        Void an open or draft invoice. This action cannot be undone. Requires
        admin role.
      </p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/invoices/inv_123/void \\
  -H "x-api-key: YOUR_API_KEY"

# Response
{
  "id": "inv_123",
  "status": "void",
  "voidedAt": "2025-01-15T10:30:00Z"
}`}</CodeBlock>

      <h2 id="pay-invoice">Retry Payment</h2>
      <p>
        Trigger a payment attempt for an open invoice. The customer's default
        payment method will be charged. Requires admin role.
      </p>
      <CodeBlock
        title="Terminal"
        language="bash"
      >{`curl -X POST http://localhost:3002/api/v1/invoices/inv_123/pay \\
  -H "x-api-key: YOUR_API_KEY"`}</CodeBlock>
      <p>
        <strong>Note:</strong> The actual status update will come via webhook
        after payment processing.
      </p>

      <h2 id="sdk">SDK Usage</h2>
      <CodeBlock
        title="invoices.ts"
        language="typescript"
      >{`import { ZentlaClient } from '@hexrift/zentla-sdk';

const zentla = new ZentlaClient({ apiKey: 'YOUR_API_KEY' });

// List invoices
const { data: invoices } = await zentla.invoices.list({
  customerId: 'cust_123',
  status: 'paid'
});

// Get invoice details
const invoice = await zentla.invoices.get('inv_123');

// Get PDF URL
const { url } = await zentla.invoices.getPdfUrl('inv_123');

// Void an invoice
await zentla.invoices.void('inv_123');

// Retry payment
await zentla.invoices.pay('inv_123');`}</CodeBlock>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Related Guides</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="/docs/refunds"
              className="text-primary-600 hover:text-primary-700"
            >
              Refunds →
            </a>
            <span className="text-gray-500 ml-2">
              Process refunds for invoices
            </span>
          </li>
          <li>
            <a
              href="/docs/webhooks"
              className="text-primary-600 hover:text-primary-700"
            >
              Webhooks →
            </a>
            <span className="text-gray-500 ml-2">Handle invoice events</span>
          </li>
        </ul>
      </div>
    </article>
  );
}
