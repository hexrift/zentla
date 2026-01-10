import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { WorkspaceProvider } from "./lib/workspace-context";
import ProtectedRoute from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CheckoutsPage } from "./pages/CheckoutsPage";
import { OffersPage } from "./pages/OffersPage";
import { OfferNewPage } from "./pages/OfferNewPage";
import { OfferDetailPage } from "./pages/OfferDetailPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { PromotionNewPage } from "./pages/PromotionNewPage";
import { PromotionDetailPage } from "./pages/PromotionDetailPage";
import { SubscriptionsPage } from "./pages/SubscriptionsPage";
import { SubscriptionDetailPage } from "./pages/SubscriptionDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { EventsPage } from "./pages/EventsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { SettingsPage } from "./pages/SettingsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ExperimentsPage } from "./pages/ExperimentsPage";
import { ExperimentNewPage } from "./pages/ExperimentNewPage";
import { ExperimentDetailPage } from "./pages/ExperimentDetailPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { RefundsPage } from "./pages/RefundsPage";
import { RefundDetailPage } from "./pages/RefundDetailPage";
import { DunningPage } from "./pages/DunningPage";
import { PortalLoginPage } from "./pages/portal/PortalLoginPage";
import { PortalVerifyPage } from "./pages/portal/PortalVerifyPage";
import { PortalDashboardPage } from "./pages/portal/PortalDashboardPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Customer Portal routes (public) */}
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="/portal/verify" element={<PortalVerifyPage />} />
        <Route path="/portal" element={<PortalDashboardPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WorkspaceProvider>
                <Layout />
              </WorkspaceProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="experiments/new" element={<ExperimentNewPage />} />
          <Route path="experiments/:id" element={<ExperimentDetailPage />} />
          <Route path="checkouts" element={<CheckoutsPage />} />
          <Route path="offers" element={<OffersPage />} />
          <Route path="offers/new" element={<OfferNewPage />} />
          <Route path="offers/:id" element={<OfferDetailPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="promotions/new" element={<PromotionNewPage />} />
          <Route path="promotions/:id" element={<PromotionDetailPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route
            path="subscriptions/:id"
            element={<SubscriptionDetailPage />}
          />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="refunds" element={<RefundsPage />} />
          <Route path="refunds/:id" element={<RefundDetailPage />} />
          <Route path="dunning" element={<DunningPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
