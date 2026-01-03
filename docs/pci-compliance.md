# PCI Compliance

Zentla is designed to maintain PCI DSS compliance by minimizing the PCI scope and delegating sensitive payment operations to certified providers.

## PCI Boundary Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR APPLICATION                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Out of PCI Scope                          │   │
│  │  - User authentication                                       │   │
│  │  - Business logic                                            │   │
│  │  - Zentla SDK integration                                     │   │
│  │  - Subscription status checks                                │   │
│  │  - Entitlement verification                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            ZENTLA                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Minimal PCI Scope (SAQ-A)                  │   │
│  │  - Checkout session orchestration (no card data)            │   │
│  │  - Subscription lifecycle management                         │   │
│  │  - Webhook processing (signed payloads)                     │   │
│  │  - Token references only (Stripe customer IDs, price IDs)   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     STRIPE (PCI DSS Level 1)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Full PCI Scope                             │   │
│  │  - Card data collection (Stripe Elements/Checkout)          │   │
│  │  - Payment processing                                        │   │
│  │  - Card storage (tokenization)                              │   │
│  │  - Fraud detection                                           │   │
│  │  - 3D Secure authentication                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Compliance Strategy

### 1. No Card Data Storage

Zentla never stores, processes, or transmits cardholder data:

| Data Type         | Zentla Storage | Provider Storage |
| ----------------- | -------------- | ---------------- |
| Card Number (PAN) | Never          | Tokenized        |
| CVV/CVC           | Never          | Never (per PCI)  |
| Expiration Date   | Never          | Tokenized        |
| Cardholder Name   | Never          | Tokenized        |
| Customer ID       | Reference only | Full record      |
| Payment Method ID | Reference only | Full record      |

### 2. Tokenization Pattern

All payment references use provider tokens:

```typescript
// What Zentla stores (ProviderRef table)
{
  entityType: 'customer',
  entityId: 'zentla_customer_abc123',
  provider: 'stripe',
  externalId: 'cus_stripe123'  // Token reference, not card data
}

// What Stripe stores (their system)
{
  id: 'cus_stripe123',
  default_payment_method: 'pm_xxx',  // Tokenized card
  // Actual card data encrypted at Stripe
}
```

### 3. Secure Checkout Flow

Card collection happens entirely on the provider's domain:

```
1. Your app calls Zentla SDK: zentla.checkout.createSession()
2. Zentla creates session, gets Stripe Checkout URL
3. Customer redirected to checkout.stripe.com
4. Card entered directly on Stripe (never touches Zentla)
5. Stripe webhook notifies Zentla of completion
6. Zentla creates subscription record (no card data)
7. Customer redirected to your success URL
```

### 4. Webhook Security

All webhooks are verified to prevent tampering:

```typescript
// Inbound from Stripe
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET,
);

// Outbound to your app
const signature = hmac("sha256", secret, `${timestamp}.${payload}`);
headers["Zentla-Signature"] = `t=${timestamp},v1=${signature}`;
```

## SAQ-A Eligibility

Zentla qualifies for SAQ-A (the simplest self-assessment questionnaire) because:

1. **No direct card data handling** - All card collection via Stripe Checkout
2. **No card data storage** - Only token references stored
3. **No card data transmission** - Redirects, not proxying
4. **HTTPS everywhere** - TLS enforced in production
5. **Provider certified** - Stripe is PCI DSS Level 1 certified

## Security Controls

### Encryption

| Layer    | Implementation                         |
| -------- | -------------------------------------- |
| Transit  | TLS 1.2+ (HTTPS enforced)              |
| At Rest  | Database encryption (provider managed) |
| Secrets  | Environment variables (never in code)  |
| API Keys | SHA-256 hashed before storage          |

### Access Control

| Control          | Implementation                        |
| ---------------- | ------------------------------------- |
| Authentication   | API Key with Bearer token             |
| Authorization    | RBAC (owner, admin, member, readonly) |
| Tenant Isolation | Workspace-scoped queries              |
| Rate Limiting    | Per IP/API key/workspace              |

### Monitoring

| Capability      | Implementation                          |
| --------------- | --------------------------------------- |
| Audit Logging   | All mutations logged with actor         |
| Request Logging | Structured JSON (Pino)                  |
| Webhook Events  | Full event history with delivery status |
| Health Checks   | Liveness/readiness probes               |

## Provider Responsibility Matrix

| Responsibility        | Zentla             | Stripe                   |
| --------------------- | ------------------ | ------------------------ |
| Card collection UI    | -                  | Stripe Checkout/Elements |
| Card data encryption  | -                  | Yes                      |
| PCI DSS certification | SAQ-A              | Level 1                  |
| Fraud detection       | -                  | Radar                    |
| 3D Secure             | -                  | Native support           |
| Chargeback handling   | Webhook processing | Full management          |
| Refund processing     | API orchestration  | Actual refund            |

## Deployment Checklist

Before going to production, verify:

- [ ] TLS certificate installed and valid
- [ ] HTTPS enforced (no HTTP fallback)
- [ ] Environment variables for all secrets
- [ ] No secrets in code or version control
- [ ] Stripe webhook secret configured
- [ ] Webhook signature verification enabled
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Health checks accessible
- [ ] Database encryption enabled (provider setting)
- [ ] Backup encryption enabled (provider setting)

## Annual Review

Maintain compliance with yearly reviews:

1. **Vendor Assessment** - Verify Stripe maintains PCI certification
2. **Access Review** - Audit API key usage and revoke unused
3. **Penetration Testing** - Annual security assessment
4. **Log Review** - Sample audit logs for anomalies
5. **Incident Response** - Update and test procedures

## Incident Response

If a security incident occurs:

1. **Contain** - Revoke affected API keys immediately
2. **Assess** - Determine scope (Zentla data vs provider data)
3. **Notify** - Contact Stripe if their data affected
4. **Report** - Document timeline and actions
5. **Remediate** - Fix vulnerability and verify
6. **Review** - Post-incident analysis

## Resources

- [Stripe PCI Compliance Guide](https://stripe.com/guides/pci-compliance)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/)
- [SAQ A Requirements](https://www.pcisecuritystandards.org/document_library/)
