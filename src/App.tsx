import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Plans from "./pages/Plans";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import ProjectEditor from "./pages/ProjectEditor";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Admin from "./pages/Admin";
import DiscordUsernameChecker from "./pages/DiscordUsernameChecker";
import Tools from "./pages/Tools";
import NitroGenerator from "./pages/NitroGenerator";
import DiscordTimestamp from "./pages/DiscordTimestamp";
import NotFound from "./pages/NotFound";
import GiftPopup from "./components/GiftPopup";

const queryClient = new QueryClient();

const App = () => {
  const { i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/new-project" element={<NewProject />} />
            <Route path="/dashboard/project/:id" element={<ProjectEditor />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/tools/discord-username-checker" element={<DiscordUsernameChecker />} />
            <Route path="/tools/nitro-generator" element={<NitroGenerator />} />
            <Route path="/tools/discord-timestamp" element={<DiscordTimestamp />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <GiftPopup />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
