# Zentla API Versioning Strategy

**Internal Document** - Guidelines for maintaining API compatibility and versioning across the platform.

---

## 1. API Versioning

### Approach: URI-Based Versioning

All API endpoints use URI-based versioning with the format `/api/v{n}/`:

```
/api/v1/subscriptions
/api/v1/customers
/api/v1/offers
```

### Version Response Headers

Every API response includes:

| Header                   | Example | Description                        |
| ------------------------ | ------- | ---------------------------------- |
| `X-API-Version`          | `1`     | Current API version                |
| `X-Zentla-API-Deprecated` | `false` | Whether this version is deprecated |

### When to Create a New Version

Create a new major version (`v2`, `v3`, etc.) only for **breaking changes**:

- Removing an endpoint
- Removing a required field from responses
- Changing a field's type (e.g., string to number)
- Changing enum values
- Renaming fields in responses
- Changing authentication requirements

**Non-breaking changes** (no new version needed):

- Adding new endpoints
- Adding optional request fields
- Adding new response fields (additive)
- Adding new enum values
- Adding new error codes
- Performance improvements

### Deprecation Process

1. **Announce**: Set `X-Zentla-API-Deprecated: true` header with deprecation date
2. **Document**: Update API docs with migration guide
3. **Notify**: Email all API key holders with deprecation timeline
4. **Timeline**:
   - Production: 3-month notice minimum
   - Beta period: 2-week notice

---

## 2. Offer Versioning

Offers use domain-level versioning with immutable versions.

### States

| State       | Description                              | Editable |
| ----------- | ---------------------------------------- | -------- |
| `draft`     | Work in progress                         | Yes      |
| `published` | Active for new subscriptions             | No       |
| `archived`  | Retired, existing subscriptions continue | No       |

### Version Flow

```
draft (v1) → published (v1) → archived (v1)
                   ↓
             draft (v2) → published (v2)
```

### Rules

- Only one version can be `published` at a time per offer
- Publishing a new version automatically archives the previous
- Existing subscriptions retain their version's terms
- Archived versions can still be referenced but not assigned to new subscriptions

---

## 3. Promotion Versioning

Promotions follow the same versioning model as Offers:

- `draft` → `published` → `archived`
- Immutable once published
- New versions for any changes

---

## 4. Webhook Payload Versioning

### Approach: Additive Only

Webhook payloads follow additive-only changes:

- New fields may be added at any time
- Existing fields are never removed or renamed
- Field types never change
- Clients must ignore unknown fields

### Webhook Version Header

```
X-Zentla-Webhook-Version: 1
```

### Breaking Change Policy

If a breaking change to webhooks is unavoidable:

1. Create new event type with suffix (e.g., `subscription.created.v2`)
2. Keep old event type active for 6 months
3. Allow endpoints to opt into new event types

---

## 5. SDK Versioning

### Semver

SDKs use semantic versioning (semver):

```
MAJOR.MINOR.PATCH
```

| Component | When to Increment                        |
| --------- | ---------------------------------------- |
| MAJOR     | API version bump or breaking SDK changes |
| MINOR     | New features, additive API changes       |
| PATCH     | Bug fixes, documentation                 |

### API Version Mapping

| SDK Version | API Version |
| ----------- | ----------- |
| 1.x.x       | v1          |
| 2.x.x       | v2 (future) |

---

## 6. Stripe API Version Pinning

### Current Pin

The Zentla API pins to a specific Stripe API version to ensure consistent behavior:

```typescript
// In stripe.adapter.ts
const stripe = new Stripe(apiKey, {
  apiVersion: "2024-11-20.acacia",
});
```

### Upgrade Process

1. Review Stripe changelog for breaking changes
2. Test all integration points in sandbox
3. Update adapter code if needed
4. Update version pin
5. Deploy to staging
6. Monitor for errors
7. Deploy to production

### Stripe Version in Headers

Stripe webhooks include their API version in the `stripe-signature` header context. Log this for debugging.

---

## 7. Database Schema Versioning

### Migrations

- All schema changes use Prisma migrations
- Migrations are versioned and tracked in git
- Never edit existing migrations
- Rollback by creating new migration

### Backward Compatibility

- New columns must have defaults or be nullable
- Column removal: deprecate first, remove in next release
- Index changes: add new index before removing old

---

## 8. Beta Period Exceptions

During beta (`X-Zentla-Beta: true`):

- Breaking changes may occur with 2-week notice
- All clients acknowledged beta terms
- Version deprecation may be faster
- Feedback channels monitored for impact

### Post-Beta

Once GA is declared:

- Full deprecation timelines apply
- SLA commitments activate
- Breaking changes require major version bump

---

## Quick Reference

| Component  | Versioning Style   | Breaking Change Policy |
| ---------- | ------------------ | ---------------------- |
| REST API   | URI-based (`/v1/`) | New major version      |
| Offers     | Immutable versions | New version            |
| Promotions | Immutable versions | New version            |
| Webhooks   | Additive only      | New event type         |
| SDKs       | Semver             | Major version bump     |
| Stripe     | Pinned version     | Explicit upgrade       |

---

## Contacts

- API Changes: Engineering team review required
- SDK Updates: Publish to npm/PyPI after testing
- Deprecation Communications: Product team coordinates
