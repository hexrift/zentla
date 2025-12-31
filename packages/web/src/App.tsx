import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DocsLayout } from "./components/DocsLayout";
import { HomePage } from "./pages/HomePage";
import { QuickstartPage } from "./pages/docs/QuickstartPage";
import { HeadlessCheckoutPage } from "./pages/docs/HeadlessCheckoutPage";
import { WebhooksPage } from "./pages/docs/WebhooksPage";
import { VersioningPage } from "./pages/docs/VersioningPage";
import { ExamplePage } from "./pages/docs/ExamplePage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<QuickstartPage />} />
        <Route path="quickstart" element={<QuickstartPage />} />
        <Route path="headless-checkout" element={<HeadlessCheckoutPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="example" element={<ExamplePage />} />
        <Route path="versioning" element={<VersioningPage />} />
      </Route>
    </Routes>
  );
}

export default App;
