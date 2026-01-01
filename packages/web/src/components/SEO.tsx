import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  image?: string;
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
}: SEOProps) {
  const fullTitle = title ? `${title} | Relay` : DEFAULT_TITLE;
  const url = `${BASE_URL}${path}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
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
    </Helmet>
  );
}
