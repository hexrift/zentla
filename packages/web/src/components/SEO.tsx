import { Helmet } from "react-helmet-async";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  image?: string;
  breadcrumbs?: BreadcrumbItem[];
}

const BASE_URL = "https://relay-web.pages.dev";
const DEFAULT_TITLE = "Relay - Subscription Management API";
const DEFAULT_DESCRIPTION =
  "Relay is a subscription management API for modern apps. Manage offers, customers, entitlements, and checkouts with a simple, provider-agnostic API.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.svg`;

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  type = "website",
  image = DEFAULT_IMAGE,
  breadcrumbs,
}: SEOProps) {
  const fullTitle = title ? `${title} | Relay` : DEFAULT_TITLE;
  const url = `${BASE_URL}${path}`;

  // Generate BreadcrumbList JSON-LD schema
  const breadcrumbSchema = breadcrumbs
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${BASE_URL}${item.path}`,
        })),
      }
    : null;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta
        name="google-site-verification"
        content="pEPgBadgZez9E_3FVsKPcXGFT-t88reFWw7hOESDt7A"
      />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Breadcrumb Schema */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
}
