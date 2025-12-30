import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { OffersPage } from './pages/OffersPage';
import { OfferNewPage } from './pages/OfferNewPage';
import { OfferDetailPage } from './pages/OfferDetailPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { PromotionNewPage } from './pages/PromotionNewPage';
import { PromotionDetailPage } from './pages/PromotionDetailPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { SubscriptionDetailPage } from './pages/SubscriptionDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { EventsPage } from './pages/EventsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/offers" replace />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="offers/new" element={<OfferNewPage />} />
        <Route path="offers/:id" element={<OfferDetailPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="promotions/new" element={<PromotionNewPage />} />
        <Route path="promotions/:id" element={<PromotionDetailPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
