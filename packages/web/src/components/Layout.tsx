import { useState } from "react";
import { Outlet, Link } from "react-router-dom";

const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_URL || "http://localhost:3001";
const API_DOCS_URL =
  import.meta.env.VITE_API_DOCS_URL || "http://localhost:3002/docs";

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Zentla
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Beta
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/docs"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Docs
              </Link>
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                API Reference
              </a>
              <Link
                to="/feedback"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Feedback
              </Link>
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <a href={DASHBOARD_URL} className="btn-secondary">
                Dashboard
              </a>
              <Link to="/docs/quickstart" className="btn-primary">
                Get Started
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              <div className="flex flex-col gap-4">
                <Link
                  to="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600"
                >
                  Docs
                </Link>
                <a
                  href={API_DOCS_URL}
                  target="_blank"
                  rel="noopener"
                  className="text-sm font-medium text-gray-600"
                >
                  API Reference
                </a>
                <Link
                  to="/feedback"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600"
                >
                  Feedback
                </Link>
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                  <a href={DASHBOARD_URL} className="btn-secondary text-center">
                    Dashboard
                  </a>
                  <Link
                    to="/docs/quickstart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary text-center"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">R</span>
                </div>
                <span className="font-semibold text-gray-900">Zentla</span>
              </div>
              <p className="text-sm text-gray-500">
                Subscription management for modern apps.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Documentation</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/docs/quickstart"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Quickstart
                  </Link>
                </li>
                <li>
                  <Link
                    to="/docs/headless-checkout"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Headless Checkout
                  </Link>
                </li>
                <li>
                  <Link
                    to="/docs/webhooks"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Webhooks
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href={API_DOCS_URL}
                    target="_blank"
                    rel="noopener"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    API Reference
                  </a>
                </li>
                <li>
                  <Link
                    to="/docs/versioning"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Versioning
                  </Link>
                </li>
                <li>
                  <Link
                    to="/feedback"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Feedback
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Product</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href={DASHBOARD_URL}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Dashboard
                  </a>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Contact Sales
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-400 text-center">
              Zentla is currently in beta. We'd love your feedback!
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
