# Admin Dashboard UI Copy

Clear, non-technical copy for the Relay admin dashboard.

---

## Navigation Labels

| Section | Label | Tooltip |
|---------|-------|---------|
| Offers | Offers | Manage your pricing plans |
| Subscriptions | Subscriptions | View active and past subscriptions |
| Customers | Customers | Manage your customer accounts |
| Webhooks | Webhooks | Configure event notifications |
| API Keys | API Keys | Manage access credentials |
| Settings | Settings | Workspace configuration |

---

## Environment Indicator

### Test Mode Banner
```
🧪 Test Mode
You're viewing test data. Payments won't be processed.
[Switch to Live →]
```

### Live Mode Banner
```
🟢 Live Mode
Real payments are being processed.
[Switch to Test →]
```

---

## Offers Section

### Page Header
```
Offers
Create and manage your pricing plans. Each offer defines what customers pay
and what features they receive.
```

### Empty State
```
No offers yet

Offers define your pricing plans. Create your first offer to start
accepting payments from customers.

[+ Create Your First Offer]
```

### Offer States

| State | Badge Color | Label | Description |
|-------|-------------|-------|-------------|
| Draft | Yellow | Draft | Not yet available for purchase |
| Published | Green | Live | Customers can subscribe to this offer |
| Archived | Gray | Archived | No longer available for new subscriptions |

### Offer Card
```
┌─────────────────────────────────────────────┐
│ Pro Plan                           [Live]   │
│ $29/month                                   │
│                                             │
│ 14-day free trial • 3 entitlements          │
│                                             │
│ Last updated: 2 hours ago                   │
└─────────────────────────────────────────────┘
```

### Create Offer Form

**Name Field**
```
Label: Offer Name
Placeholder: e.g., Pro Plan, Enterprise, Starter
Helper: This is what customers will see during checkout.
```

**Description Field**
```
Label: Description
Placeholder: Describe what's included in this plan...
Helper: A brief summary shown on the checkout page.
```

**Pricing Section**
```
Header: Pricing
Subheader: Set how much customers pay and how often.
```

**Amount Field**
```
Label: Price
Placeholder: 29.00
Helper: Enter the amount in dollars. We'll handle the cents.
```

**Interval Field**
```
Label: Billing Frequency
Options:
  - Daily
  - Weekly
  - Monthly (most common)
  - Yearly
```

### Publish Confirmation Dialog
```
Title: Publish this offer?

Body:
Once published, customers can subscribe to "Pro Plan" at $29/month.

You can create new versions later, but existing subscribers will stay
on their current terms unless you migrate them.

[Cancel] [Publish Offer]
```

### Archive Confirmation Dialog
```
Title: Archive this offer?

Body:
Archiving "Pro Plan" will:
• Hide it from new customers
• Keep existing subscriptions active
• Preserve all historical data

This can't be undone, but you can create a new offer anytime.

[Cancel] [Archive Offer]
```

### Version History
```
Header: Version History

Subheader: Each version is a snapshot of your offer's configuration.
Changes to pricing or features require a new version.

┌─────────────────────────────────────────────┐
│ Version 3                          [Live]   │
│ Published on Dec 15, 2024                   │
│ $29/month • 14-day trial                    │
├─────────────────────────────────────────────┤
│ Version 2                       [Archived]  │
│ Published on Nov 1, 2024                    │
│ $19/month • 7-day trial                     │
├─────────────────────────────────────────────┤
│ Version 1                       [Archived]  │
│ Published on Oct 1, 2024                    │
│ $19/month • No trial                        │
└─────────────────────────────────────────────┘
```

---

## Subscriptions Section

### Page Header
```
Subscriptions
Track your active subscriptions and customer billing status.
```

### Empty State
```
No subscriptions yet

When customers complete checkout, their subscriptions will appear here.
Create an offer first, then share the checkout link with customers.

[View Offers →]
```

### Subscription States

| State | Badge Color | Label | Customer-Friendly Meaning |
|-------|-------------|-------|---------------------------|
| Active | Green | Active | Subscription is current and paid |
| Trialing | Blue | Trial | Free trial period, no charge yet |
| Past Due | Orange | Past Due | Payment failed, retrying |
| Canceled | Gray | Canceled | Subscription ended |
| Paused | Yellow | Paused | Temporarily suspended |

### Subscription Card
```
┌─────────────────────────────────────────────┐
│ john@example.com                  [Active]  │
│ Pro Plan • $29/month                        │
│                                             │
│ Next billing: Jan 15, 2025                  │
│ Started: Dec 15, 2024                       │
│                                             │
│ [View Details] [Cancel]                     │
└─────────────────────────────────────────────┘
```

### Cancel Confirmation Dialog
```
Title: Cancel this subscription?

Body:
Canceling will:
• End access on Feb 15, 2025 (end of current period)
• Not issue a refund for the current period
• Allow the customer to resubscribe later

☐ Cancel immediately (ends access today)

[Keep Subscription] [Cancel Subscription]
```

---

## Customers Section

### Page Header
```
Customers
View and manage your customer accounts.
```

### Empty State
```
No customers yet

Customers are created automatically when they complete checkout,
or you can add them manually.

[+ Add Customer]
```

### Customer Card
```
┌─────────────────────────────────────────────┐
│ Jane Smith                                  │
│ jane@company.com                            │
│                                             │
│ 2 active subscriptions                      │
│ Customer since Dec 1, 2024                  │
│                                             │
│ [View Details]                              │
└─────────────────────────────────────────────┘
```

---

## Webhooks Section

### Page Header
```
Webhooks
Get notified when events happen in your Relay workspace.
We'll send a POST request to your URL for each event.
```

### Empty State
```
No webhooks configured

Webhooks let your application react to events like new subscriptions,
cancellations, and payment failures in real-time.

[+ Add Webhook Endpoint]
```

### Create Webhook Form

**URL Field**
```
Label: Endpoint URL
Placeholder: https://your-app.com/webhooks/relay
Helper: Must be HTTPS and publicly accessible.
```

**Events Field**
```
Label: Events to send
Helper: Select which events should trigger this webhook.

☐ Select all

Subscriptions
  ☐ subscription.created - New subscription started
  ☐ subscription.updated - Subscription details changed
  ☐ subscription.canceled - Subscription ended

Customers
  ☐ customer.created - New customer added
  ☐ customer.updated - Customer details changed

Payments
  ☐ invoice.paid - Payment successful
  ☐ invoice.payment_failed - Payment failed
```

### Webhook Status

| Status | Badge | Meaning |
|--------|-------|---------|
| Active | Green | Receiving events |
| Disabled | Gray | Paused, not sending |
| Failing | Red | Recent deliveries failed |

---

## API Keys Section

### Page Header
```
API Keys
Manage credentials for accessing the Relay API.
Keep your keys secure and never share them publicly.
```

### Empty State
```
No API keys

Create an API key to start integrating with Relay.

[+ Create API Key]
```

### Environment Explanation
```
Test Keys (relay_test_...)
Use for development and testing. No real charges.

Live Keys (relay_live_...)
Use in production. Processes real payments.
```

### Role Explanation
```
Owner - Full access to all resources and settings
Admin - Can manage offers, subscriptions, and webhooks
Member - Read-only access to most resources
```

### Key Created Success
```
Title: API Key Created

Body:
Your new API key is ready. Copy it now — you won't be able to see it again.

┌─────────────────────────────────────────────┐
│ relay_test_abc123def456...                  │
│                                    [Copy]   │
└─────────────────────────────────────────────┘

Store this key securely. If you lose it, you'll need to create a new one.

[Done]
```

### Revoke Key Confirmation
```
Title: Revoke this API key?

Body:
Revoking "Production Key" will immediately disable it.
Any applications using this key will stop working.

This cannot be undone.

[Cancel] [Revoke Key]
```

---

## Settings Section

### Page Header
```
Settings
Configure your Relay workspace.
```

### Workspace Settings
```
Header: Workspace

Name Field:
  Label: Workspace Name
  Helper: Used to identify your workspace in the dashboard.

Default Currency:
  Label: Default Currency
  Helper: The default currency for new offers. Customers see prices in this currency.
```

### Danger Zone
```
Header: Danger Zone

Body:
These actions are destructive and cannot be undone.

[Delete Workspace]
```

---

## Global Messages

### Success Toasts
```
Offer created successfully
Offer published — customers can now subscribe
Subscription canceled
Webhook endpoint added
API key created — don't forget to copy it!
Settings saved
```

### Error Toasts
```
Something went wrong. Please try again.
Unable to connect. Check your internet connection.
This offer has active subscriptions and cannot be deleted.
Invalid API key. Please check your credentials.
Webhook URL must use HTTPS.
```

### Loading States
```
Creating offer...
Publishing...
Loading subscriptions...
Saving changes...
```

---

## Tooltips

| Element | Tooltip |
|---------|---------|
| Draft badge | This version isn't available to customers yet |
| Live badge | Customers can subscribe to this offer |
| Archived badge | No longer accepting new subscriptions |
| Trial days | Customers get free access for this many days |
| Entitlements | Features and limits included with this offer |
| Webhook secret | Use this to verify webhook signatures |
| Test mode | Use test API keys and test card numbers |
