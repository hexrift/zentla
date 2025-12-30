import { CodeBlock } from '../../components/CodeBlock';

export function HeadlessCheckoutPage() {
  return (
    <article className="prose-docs">
      <h1>Headless Checkout</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        Build fully custom checkout experiences while Relay handles pricing logic,
        entitlements, and provider integration behind the scenes.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        Headless checkout lets you create your own payment UI while Relay manages:
      </p>
      <ul>
        <li>Price calculation and currency formatting</li>
        <li>Trial periods and promotional codes</li>
        <li>Stripe Customer and PaymentIntent creation</li>
        <li>Subscription provisioning after payment</li>
        <li>Entitlement activation</li>
      </ul>

      <h2 id="flow">Checkout Flow</h2>
      <p>The headless checkout flow has three steps:</p>

      <div className="not-prose my-8">
        <div className="flex flex-col sm:flex-row gap-4 text-sm">
          <div className="flex-1 p-4 bg-gray-50 rounded-lg">
            <div className="font-semibold text-gray-900 mb-1">1. Create Intent</div>
            <div className="text-gray-600">Initialize checkout with offer and customer</div>
          </div>
          <div className="hidden sm:flex items-center text-gray-300">→</div>
          <div className="flex-1 p-4 bg-gray-50 rounded-lg">
            <div className="font-semibold text-gray-900 mb-1">2. Collect Payment</div>
            <div className="text-gray-600">Use Stripe Elements in your UI</div>
          </div>
          <div className="hidden sm:flex items-center text-gray-300">→</div>
          <div className="flex-1 p-4 bg-gray-50 rounded-lg">
            <div className="font-semibold text-gray-900 mb-1">3. Confirm Intent</div>
            <div className="text-gray-600">Relay provisions the subscription</div>
          </div>
        </div>
      </div>

      <h2 id="step-1-create-intent">Step 1: Create a Checkout Intent</h2>
      <p>
        A checkout intent reserves pricing and prepares Stripe resources. It returns
        a <code>clientSecret</code> for Stripe Elements.
      </p>
      <CodeBlock title="Terminal" language="bash">{`curl -X POST http://localhost:3002/api/v1/checkout/intents \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "customerId": "cust_...",
    "offerId": "offer_...",
    "promotionCode": "SAVE20"
  }'

# Response
{
  "id": "ci_...",
  "status": "pending",
  "offer": {
    "id": "offer_...",
    "name": "Pro Plan"
  },
  "pricing": {
    "subtotal": 2900,
    "discount": 580,
    "total": 2320,
    "currency": "USD",
    "interval": "month"
  },
  "trial": null,
  "stripeClientSecret": "pi_...secret_...",
  "expiresAt": "2025-01-15T12:00:00Z"
}`}</CodeBlock>

      <h2 id="step-2-collect-payment">Step 2: Collect Payment Details</h2>
      <p>
        Use Stripe Elements to collect payment information. The <code>clientSecret</code>
        from the intent response initializes the PaymentElement.
      </p>
      <CodeBlock title="CheckoutForm.tsx" language="tsx">{`import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...');

function CheckoutForm({ clientSecret }) {
  const stripe = useStripe();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: 'https://yourapp.com/checkout/complete',
      },
    });

    if (error) {
      // Show error to customer
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit">Subscribe</button>
    </form>
  );
}

function App() {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm clientSecret={clientSecret} />
    </Elements>
  );
}`}</CodeBlock>

      <h2 id="step-3-confirm-intent">Step 3: Confirm the Intent</h2>
      <p>
        After Stripe confirms the payment, call Relay to provision the subscription:
      </p>
      <CodeBlock title="Terminal" language="bash">{`curl -X POST http://localhost:3002/api/v1/checkout/intents/{intentId}/confirm \\
  -H "x-api-key: YOUR_API_KEY"

# Response
{
  "id": "ci_...",
  "status": "completed",
  "subscriptionId": "sub_...",
  "customerId": "cust_..."
}`}</CodeBlock>

      <h2 id="handling-trials">Handling Trials</h2>
      <p>
        If the offer includes a trial period, no payment is collected upfront:
      </p>
      <CodeBlock title="Response" language="json">{`// Intent response with trial
{
  "id": "ci_...",
  "status": "pending",
  "pricing": {
    "subtotal": 2900,
    "discount": 0,
    "total": 0,
    "currency": "USD",
    "interval": "month"
  },
  "trial": {
    "days": 14,
    "endsAt": "2025-01-29T00:00:00Z"
  },
  "stripeClientSecret": "seti_...secret_..."
}`}</CodeBlock>
      <p>
        For trials, Stripe returns a SetupIntent secret instead of PaymentIntent.
        Use <code>stripe.confirmSetup()</code> to save the payment method for future billing.
      </p>

      <h2 id="promotions">Applying Promotions</h2>
      <p>
        Pass a <code>promotionCode</code> when creating the intent to apply discounts:
      </p>
      <CodeBlock title="Request body" language="json">{`{
  "customerId": "cust_...",
  "offerId": "offer_...",
  "promotionCode": "LAUNCH50"
}`}</CodeBlock>
      <p>
        Invalid or expired codes return a <code>PROMOTION_INVALID</code> error.
        The <code>pricing</code> object in the response shows the applied discount.
      </p>

      <h2 id="metadata">Passing Metadata</h2>
      <p>
        Include custom metadata for attribution tracking. This flows through to
        the subscription and webhook events:
      </p>
      <CodeBlock title="Request body" language="json">{`{
  "customerId": "cust_...",
  "offerId": "offer_...",
  "metadata": {
    "campaign": "black_friday_2025",
    "referrer": "partner_abc",
    "utm_source": "google"
  }
}`}</CodeBlock>

      <h2 id="error-handling">Error Handling</h2>
      <p>Common errors during headless checkout:</p>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">Code</th>
              <th className="text-left py-2 font-medium text-gray-900">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4"><code>OFFER_NOT_PUBLISHED</code></td>
              <td className="py-2 text-gray-600">The offer hasn't been published yet</td>
            </tr>
            <tr>
              <td className="py-2 pr-4"><code>PROMOTION_INVALID</code></td>
              <td className="py-2 text-gray-600">Promo code is invalid, expired, or already used</td>
            </tr>
            <tr>
              <td className="py-2 pr-4"><code>CUSTOMER_NOT_FOUND</code></td>
              <td className="py-2 text-gray-600">The customer ID doesn't exist</td>
            </tr>
            <tr>
              <td className="py-2 pr-4"><code>INTENT_EXPIRED</code></td>
              <td className="py-2 text-gray-600">The checkout intent has expired</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="complete-example">Complete Example</h2>
      <p>
        Here's a full React implementation:
      </p>
      <CodeBlock title="CheckoutPage.tsx" language="tsx">{`import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...');
const API_BASE = 'http://localhost:3002/api/v1';
const API_KEY = 'YOUR_API_KEY';

function CheckoutPage({ customerId, offerId }) {
  const [intent, setIntent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Create checkout intent
    fetch(\`\${API_BASE}/checkout/intents\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ customerId, offerId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success === false) {
          setError(data.error.message);
        } else {
          setIntent(data);
        }
      });
  }, [customerId, offerId]);

  if (error) return <div className="error">{error}</div>;
  if (!intent) return <div>Loading...</div>;

  return (
    <div className="checkout">
      <h2>{intent.offer.name}</h2>
      <p>
        {(intent.pricing.total / 100).toFixed(2)} {intent.pricing.currency}
        /{intent.pricing.interval}
      </p>

      <Elements stripe={stripePromise} options={{ clientSecret: intent.stripeClientSecret }}>
        <PaymentForm intentId={intent.id} />
      </Elements>
    </div>
  );
}

function PaymentForm({ intentId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    // Confirm with Relay
    const res = await fetch(\`\${API_BASE}/checkout/intents/\${intentId}/confirm\`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
    });

    const result = await res.json();
    if (result.status === 'completed') {
      window.location.href = '/success';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Subscribe'}
      </button>
    </form>
  );
}`}</CodeBlock>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Related Guides</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/docs/quickstart" className="text-primary-600 hover:text-primary-700">
              Quickstart →
            </a>
            <span className="text-gray-500 ml-2">Get started with hosted checkout</span>
          </li>
          <li>
            <a href="/docs/webhooks" className="text-primary-600 hover:text-primary-700">
              Webhooks →
            </a>
            <span className="text-gray-500 ml-2">React to subscription events</span>
          </li>
        </ul>
      </div>
    </article>
  );
}
