import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import ArchitectureOverview from "./pages/ArchitectureOverview";
import ContributingGuide from "./pages/ContributingGuide";
import APIReference from "./pages/APIReference";
import ServicesOverview from "./pages/ServicesOverview";
import UserServiceAPI from "./pages/UserServiceAPI";
import AdminServiceAPI from "./pages/AdminServiceAPI";
import CrawlingServiceAPI from "./pages/CrawlingServiceAPI";
import WhatIsExcluded from "./pages/WhatIsExcluded";
import GettingStarted from "./pages/GettingStarted";
import ConfigurationReference from "./pages/ConfigurationReference";
import DeploymentGuide from "./pages/DeploymentGuide";
import UsageExamples from "./pages/UsageExamples";
import TroubleshootingGuide from "./pages/TroubleshootingGuide";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/getting-started" element={<GettingStarted />} />
        <Route path="/architecture/overview" element={<ArchitectureOverview />} />
        <Route path="/api/overview" element={<APIReference />} />
        <Route path="/api/user-service" element={<UserServiceAPI />} />
        <Route path="/api/admin-service" element={<AdminServiceAPI />} />
        <Route path="/api/crawling-service" element={<CrawlingServiceAPI />} />
        <Route path="/services/overview" element={<ServicesOverview />} />
        <Route path="/configuration/reference" element={<ConfigurationReference />} />
        <Route path="/deployment/guide" element={<DeploymentGuide />} />
        <Route path="/usage/examples" element={<UsageExamples />} />
        <Route path="/troubleshooting/guide" element={<TroubleshootingGuide />} />
        <Route path="/contributing/guide" element={<ContributingGuide />} />
        <Route path="/what-is-excluded" element={<WhatIsExcluded />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);

export default App;
