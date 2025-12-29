import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { OffersPage } from './pages/OffersPage';
import { OfferNewPage } from './pages/OfferNewPage';
import { OfferDetailPage } from './pages/OfferDetailPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { CustomersPage } from './pages/CustomersPage';
import { WebhooksPage } from './pages/WebhooksPage';
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
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
