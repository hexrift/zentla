import { CodeBlock } from '../../components/CodeBlock';

export function VersioningPage() {
  return (
    <article className="prose-docs">
      <h1>Versioning & Stability</h1>
      <p className="lead text-lg text-gray-600 mb-8">
        Our commitment to API stability and how we handle changes during beta and beyond.
      </p>

      <div className="not-prose mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Beta Status:</strong> Relay is currently in beta. While we aim for stability,
          some breaking changes may occur with advance notice. We'll communicate all changes
          through our changelog and email notifications.
        </p>
      </div>

      <h2 id="api-versioning">API Versioning</h2>
      <p>
        The Relay API uses URL-based versioning. The current version is <code>v1</code>:
      </p>
      <CodeBlock title="API endpoints" language="text">{`https://api.relay.com/api/v1/offers
https://api.relay.com/api/v1/customers
https://api.relay.com/api/v1/subscriptions`}</CodeBlock>

      <h3>Version Lifecycle</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">Stage</th>
              <th className="text-left py-2 font-medium text-gray-900">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 font-medium text-green-600">Current</td>
              <td className="py-2 text-gray-600">Active development, receives new features and fixes</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium text-amber-600">Deprecated</td>
              <td className="py-2 text-gray-600">Still supported, receives security fixes only</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium text-red-600">Sunset</td>
              <td className="py-2 text-gray-600">No longer available, returns 410 Gone</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="change-policy">Change Policy</h2>

      <h3>Additive Changes (Non-Breaking)</h3>
      <p>
        These changes are made without version bumps and are backward compatible:
      </p>
      <ul>
        <li>Adding new API endpoints</li>
        <li>Adding new optional request parameters</li>
        <li>Adding new fields to response objects</li>
        <li>Adding new webhook event types</li>
        <li>Adding new enum values to existing enums</li>
        <li>Relaxing validation constraints</li>
      </ul>

      <div className="not-prose my-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Design your integration to ignore unknown fields in API responses.
          This ensures additive changes don't break your code.
        </p>
      </div>

      <h3>Breaking Changes</h3>
      <p>
        These changes require a new API version:
      </p>
      <ul>
        <li>Removing endpoints or fields</li>
        <li>Changing the type of a field</li>
        <li>Renaming fields or endpoints</li>
        <li>Making optional parameters required</li>
        <li>Changing authentication methods</li>
        <li>Removing enum values</li>
      </ul>

      <h2 id="deprecation-process">Deprecation Process</h2>
      <p>
        When we deprecate functionality:
      </p>
      <ol>
        <li>
          <strong>Announcement:</strong> We announce the deprecation at least 3 months in advance
          via changelog, email, and API response headers.
        </li>
        <li>
          <strong>Deprecation Headers:</strong> Deprecated endpoints return a
          <code>X-Relay-Deprecated</code> header with migration guidance.
        </li>
        <li>
          <strong>Migration Guide:</strong> We publish detailed migration documentation.
        </li>
        <li>
          <strong>Sunset:</strong> After the deprecation period, the old version returns 410 Gone.
        </li>
      </ol>

      <CodeBlock title="Deprecation headers" language="http">{`# Example deprecation header
X-Relay-Deprecated: true
X-Relay-Sunset: 2025-06-01
X-Relay-Migration: See https://relay.com/docs/migrations/v2`}</CodeBlock>

      <h2 id="beta-considerations">Beta Considerations</h2>
      <p>
        During the beta period, we may occasionally make breaking changes with shorter notice
        (minimum 2 weeks) to address fundamental issues. We commit to:
      </p>
      <ul>
        <li>Communicating all changes via email to registered developers</li>
        <li>Providing migration scripts or tools where possible</li>
        <li>Offering direct support for migration challenges</li>
        <li>Documenting all changes in our changelog</li>
      </ul>

      <h2 id="sdk-versioning">SDK Versioning</h2>
      <p>
        Our SDKs follow semantic versioning (semver):
      </p>
      <ul>
        <li><strong>Major (X.0.0):</strong> Breaking changes</li>
        <li><strong>Minor (0.X.0):</strong> New features, backward compatible</li>
        <li><strong>Patch (0.0.X):</strong> Bug fixes, backward compatible</li>
      </ul>
      <p>
        SDK major versions correspond to API versions. For example, <code>@relay/sdk@1.x</code>
        targets API <code>v1</code>.
      </p>

      <h2 id="offer-versioning">Offer Versioning</h2>
      <p>
        Relay automatically versions offers to ensure pricing consistency:
      </p>
      <ul>
        <li>Each offer has an immutable <code>offerVersionId</code></li>
        <li>Modifying an offer creates a new version</li>
        <li>Existing subscriptions remain on their original version</li>
        <li>New checkouts use the latest published version</li>
      </ul>

      <CodeBlock title="Offer with versions" language="json">{`// Offer with versions
{
  "id": "offer_abc123",
  "name": "Pro Plan",
  "currentVersionId": "ov_v3",
  "versions": [
    { "id": "ov_v1", "status": "archived", "publishedAt": "2025-01-01" },
    { "id": "ov_v2", "status": "archived", "publishedAt": "2025-02-01" },
    { "id": "ov_v3", "status": "published", "publishedAt": "2025-03-01" }
  ]
}`}</CodeBlock>

      <h2 id="webhook-versioning">Webhook Versioning</h2>
      <p>
        Webhook payloads follow the same additive change policy:
      </p>
      <ul>
        <li>New fields may be added to event payloads</li>
        <li>New event types may be introduced</li>
        <li>Existing fields are never removed or renamed</li>
      </ul>

      <h2 id="stability-indicators">Stability Indicators</h2>
      <p>
        API endpoints are marked with stability indicators in our documentation:
      </p>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-900">Indicator</th>
              <th className="text-left py-2 font-medium text-gray-900">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">Stable</span>
              </td>
              <td className="py-2 text-gray-600">Production-ready, follows full deprecation process</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">Beta</span>
              </td>
              <td className="py-2 text-gray-600">Ready to use, may change with 2-week notice</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">Preview</span>
              </td>
              <td className="py-2 text-gray-600">Experimental, may change without notice</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="changelog">Changelog</h2>
      <p>
        All API changes are documented in our changelog. Subscribe to receive updates:
      </p>
      <ul>
        <li>
          <a href="https://github.com/your-org/relay/releases" target="_blank" rel="noopener">
            GitHub Releases
          </a>
        </li>
        <li>RSS feed (coming soon)</li>
        <li>Email notifications via Dashboard settings</li>
      </ul>

      <h2 id="support">Getting Help</h2>
      <p>
        If you have questions about versioning or need help with migrations:
      </p>
      <ul>
        <li>
          <a href="https://github.com/your-org/relay/issues" target="_blank" rel="noopener">
            Open an issue on GitHub
          </a>
        </li>
        <li>Email us at support@relay.com</li>
        <li>Join our Discord community (coming soon)</li>
      </ul>

      <div className="not-prose mt-12 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">Our Commitment</h3>
        <p className="text-sm text-gray-600">
          We understand that API stability is crucial for your business. We're committed to
          maintaining backward compatibility and providing clear migration paths when changes
          are necessary. Your trust in Relay's stability is our priority.
        </p>
      </div>
    </article>
  );
}
