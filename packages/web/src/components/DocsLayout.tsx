import { useState, useEffect } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { clsx } from "clsx";

const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL || "http://localhost:3001";
const API_DOCS_URL =
  import.meta.env.VITE_API_DOCS_URL || "http://localhost:3002/docs";

const navigation = [
  {
    title: "Getting Started",
    items: [
      { name: "Quickstart", href: "/docs/quickstart" },
      { name: "End-to-End Example", href: "/docs/example" },
    ],
  },
  {
    title: "Guides",
    items: [
      { name: "Headless Checkout", href: "/docs/headless-checkout" },
      { name: "Webhooks", href: "/docs/webhooks" },
    ],
  },
  {
    title: "Reference",
    items: [
      { name: "API Reference", href: API_DOCS_URL, external: true },
      { name: "Versioning & Stability", href: "/docs/versioning" },
    ],
  },
];

// Table of contents for each page
const tableOfContents: Record<
  string,
  Array<{ id: string; title: string; level: number }>
> = {
  "/docs": [
    { id: "prerequisites", title: "Prerequisites", level: 2 },
    { id: "step-1-configure-stripe", title: "Configure Stripe", level: 2 },
    { id: "step-2-create-feature", title: "Define a Feature", level: 2 },
    { id: "step-3-create-offer", title: "Create an Offer", level: 2 },
    { id: "step-4-publish-offer", title: "Publish the Offer", level: 2 },
    { id: "step-5-create-customer", title: "Create a Customer", level: 2 },
    { id: "step-6-create-checkout", title: "Generate Checkout Link", level: 2 },
    { id: "step-7-check-entitlements", title: "Check Entitlements", level: 2 },
    { id: "whats-next", title: "What's Next", level: 2 },
  ],
  "/docs/quickstart": [
    { id: "prerequisites", title: "Prerequisites", level: 2 },
    { id: "step-1-configure-stripe", title: "Configure Stripe", level: 2 },
    { id: "step-2-create-feature", title: "Define a Feature", level: 2 },
    { id: "step-3-create-offer", title: "Create an Offer", level: 2 },
    { id: "step-4-publish-offer", title: "Publish the Offer", level: 2 },
    { id: "step-5-create-customer", title: "Create a Customer", level: 2 },
    { id: "step-6-create-checkout", title: "Generate Checkout Link", level: 2 },
    { id: "step-7-check-entitlements", title: "Check Entitlements", level: 2 },
    { id: "whats-next", title: "What's Next", level: 2 },
  ],
  "/docs/headless-checkout": [
    { id: "overview", title: "Overview", level: 2 },
    { id: "flow", title: "Checkout Flow", level: 2 },
    { id: "step-1-create-intent", title: "Create Intent", level: 2 },
    { id: "step-2-collect-payment", title: "Collect Payment", level: 2 },
    { id: "step-3-confirm-intent", title: "Confirm Intent", level: 2 },
    { id: "handling-trials", title: "Handling Trials", level: 2 },
    { id: "promotions", title: "Applying Promotions", level: 2 },
    { id: "metadata", title: "Passing Metadata", level: 2 },
    { id: "error-handling", title: "Error Handling", level: 2 },
    { id: "complete-example", title: "Complete Example", level: 2 },
  ],
  "/docs/webhooks": [
    { id: "overview", title: "Overview", level: 2 },
    { id: "setup", title: "Setting Up Webhooks", level: 2 },
    { id: "events", title: "Event Types", level: 2 },
    { id: "payload-examples", title: "Payload Examples", level: 2 },
    { id: "best-practices", title: "Best Practices", level: 2 },
    { id: "testing", title: "Testing Webhooks", level: 2 },
  ],
  "/docs/versioning": [
    { id: "api-versioning", title: "API Versioning", level: 2 },
    { id: "change-policy", title: "Change Policy", level: 2 },
    { id: "deprecation-process", title: "Deprecation Process", level: 2 },
    { id: "beta-considerations", title: "Beta Considerations", level: 2 },
    { id: "sdk-versioning", title: "SDK Versioning", level: 2 },
    { id: "offer-versioning", title: "Offer Versioning", level: 2 },
    { id: "webhook-versioning", title: "Webhook Versioning", level: 2 },
    { id: "stability-indicators", title: "Stability Indicators", level: 2 },
    { id: "changelog", title: "Changelog", level: 2 },
    { id: "support", title: "Getting Help", level: 2 },
  ],
  "/docs/example": [
    { id: "scenario", title: "Scenario", level: 2 },
    { id: "step-1-setup", title: "Initial Setup", level: 2 },
    { id: "step-2-offer", title: "Create Offer", level: 2 },
    { id: "step-3-webhook", title: "Set Up Webhooks", level: 2 },
    { id: "step-4-backend", title: "Backend Integration", level: 2 },
    { id: "step-5-frontend", title: "Frontend Integration", level: 2 },
    { id: "step-6-testing", title: "Testing the Flow", level: 2 },
    { id: "summary", title: "Summary", level: 2 },
  ],
};

export function DocsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>("");
  const location = useLocation();

  const currentToc = tableOfContents[location.pathname] ?? [];

  // Track active heading on scroll
  useEffect(() => {
    if (currentToc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -80% 0px", threshold: 0 },
    );

    currentToc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [currentToc, location.pathname]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header - Fixed */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 z-50">
        <nav className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <Link to="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">R</span>
                </div>
                <span className="font-semibold text-gray-900">Relay</span>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                  Beta
                </span>
              </Link>
              <span className="hidden sm:block text-gray-300">|</span>
              <span className="hidden sm:block text-sm font-medium text-gray-600">
                Documentation
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener"
                className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                API Reference
              </a>
              <Link
                to="/feedback"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
                Feedback
              </Link>
              <a
                href={DASHBOARD_URL}
                className="btn-primary text-xs py-1.5 px-3"
              >
                Dashboard
              </a>
            </div>
          </div>
        </nav>
      </header>

      {/* Main 3-column layout - Takes remaining height */}
      <div className="flex-1 flex min-h-0">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Navigation */}
        <aside
          className={clsx(
            "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:static lg:translate-x-0 flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Mobile header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
            <span className="font-medium text-gray-900">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable navigation */}
          <div className="flex-1 overflow-y-auto py-6 px-4">
            {navigation.map((section) => (
              <div key={section.title} className="mb-6">
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {section.title}
                </h5>
                <ul className="space-y-1">
                  {section.items.map((item) =>
                    item.external ? (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          {item.name}
                          <svg
                            className="w-3 h-3 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </li>
                    ) : (
                      <li key={item.name}>
                        <NavLink
                          to={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            clsx(
                              "block px-3 py-2 text-sm rounded-lg transition-colors",
                              isActive ||
                                (location.pathname === "/docs" &&
                                  item.href === "/docs/quickstart")
                                ? "bg-primary-50 text-primary-700 font-medium"
                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                            )
                          }
                        >
                          {item.name}
                        </NavLink>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}

            {/* Feedback box */}
            <div className="mt-8 p-4 bg-gray-50 rounded-xl">
              <h5 className="font-medium text-gray-900 mb-1">Have feedback?</h5>
              <p className="text-sm text-gray-500 mb-3">
                Help us improve Relay during beta.
              </p>
              <Link
                to="/feedback"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Share feedback
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </aside>

        {/* Middle - Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        </main>

        {/* Right Sidebar - Table of Contents */}
        <aside className="hidden xl:block w-64 flex-shrink-0 border-l border-gray-200">
          <div className="h-full overflow-y-auto py-6 px-4">
            {currentToc.length > 0 && (
              <>
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  On this page
                </h5>
                <nav className="space-y-1">
                  {currentToc.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToHeading(item.id)}
                      className={clsx(
                        "block w-full text-left text-sm py-1.5 transition-colors",
                        item.level === 3 ? "pl-4" : "pl-0",
                        activeHeading === item.id
                          ? "text-primary-600 font-medium"
                          : "text-gray-500 hover:text-gray-900",
                      )}
                    >
                      {item.title}
                    </button>
                  ))}
                </nav>

                {/* Quick links */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Resources
                  </h5>
                  <ul className="space-y-2">
                    <li>
                      <a
                        href={API_DOCS_URL}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        API Reference
                      </a>
                    </li>
                    <li>
                      <a
                        href={DASHBOARD_URL}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                          />
                        </svg>
                        Dashboard
                      </a>
                    </li>
                    <li>
                      <Link
                        to="/feedback"
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                          />
                        </svg>
                        Send Feedback
                      </Link>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
