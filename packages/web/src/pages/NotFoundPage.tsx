import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SEO
        title="Page Not Found"
        description="The page you're looking for doesn't exist."
        path="/404"
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">Z</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Zentla
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-medium text-primary-600 mb-2">404</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Page not found
          </h1>
          <p className="text-gray-600 mb-8 max-w-md">
            Sorry, we couldn't find the page you're looking for. It may have
            been moved or doesn't exist.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/"
              className="px-6 py-3 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to homepage
            </Link>
            <Link
              to="/docs"
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View documentation
            </Link>
          </div>

          {/* Helpful links */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Here are some helpful links:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              <Link
                to="/docs/quickstart"
                className="text-primary-600 hover:text-primary-700"
              >
                Quickstart Guide
              </Link>
              <Link
                to="/docs/example"
                className="text-primary-600 hover:text-primary-700"
              >
                End-to-End Example
              </Link>
              <Link
                to="/feedback"
                className="text-primary-600 hover:text-primary-700"
              >
                Send Feedback
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
