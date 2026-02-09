import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MultiStepRegisterPage from "./pages/MultiStepRegisterPage";
import NotFound from "./pages/NotFound";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import ProposalPaymentSuccessPage from "./pages/ProposalPaymentSuccessPage";
import SubscriptionCancelPage from "./pages/SubscriptionCancelPage";
import TwoFactorSetupPage from "./pages/TwoFactorSetupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ApiDocsPage from "./pages/ApiDocsPage";
import CloudOAuthCallbackPage from "./pages/CloudOAuthCallbackPage";
import CloudBlockDocsPage from "./pages/CloudBlockDocsPage";
import { AuthProvider } from "@/contexts/AuthContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { FeatureFlagsProvider, useFeatureFlags } from "@/contexts/FeatureFlagsContext";

const queryClient = new QueryClient();

const ConditionalSubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFeatureEnabled } = useFeatureFlags();
  
  if (isFeatureEnabled('billing')) {
    return <SubscriptionProvider>{children}</SubscriptionProvider>;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
  <TooltipProvider>
  <Toaster />
  <Sonner />
  <FeatureFlagsProvider>
  <AuthProvider>
  <TutorialProvider>
  <SubscriptionProvider>
  <BrowserRouter>
  <Routes>
  <Route path="/" element={<Index />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<MultiStepRegisterPage />} />
  <Route path="/register-old" element={<RegisterPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />
  <Route path="/builder" element={<Index />} />
  <Route path="/chatbot/:id" element={<Index />} />
  <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
  <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
  <Route path="/proposal/payment-success" element={<ProposalPaymentSuccessPage />} />
  <Route path="/2fa/setup" element={<TwoFactorSetupPage />} />
  <Route path="/terms" element={<TermsOfService />} />
  <Route path="/privacy" element={<PrivacyPolicy />} />
  <Route path="/api-docs/:chatbotId" element={<ApiDocsPage />} />
  <Route path="/cloud-oauth-callback" element={<CloudOAuthCallbackPage />} />
  <Route path="/cloud-block-docs" element={<CloudBlockDocsPage />} />
  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
  <Route path="*" element={<NotFound />} />
  </Routes>
  </BrowserRouter>
  </SubscriptionProvider>
  </TutorialProvider>
  </AuthProvider>
  </FeatureFlagsProvider>
  </TooltipProvider>
  </QueryClientProvider>
);

export default App;
