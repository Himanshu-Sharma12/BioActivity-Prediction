import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/navbar";
import AdvancedChatbot from "@/components/advanced-chatbot";
import Footer from "@/components/footer";
import ErrorBoundary from "@/components/error-boundary";
import Welcome from "@/pages/welcome";
import Dashboard from "@/pages/dashboard";
import IotAnalysisPage from "@/pages/iot-analysis";
import SafetyPage from "@/pages/safety";
import ExportPage from "@/pages/export";
import DrawPage from "@/pages/draw";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/analyze" component={Dashboard} />
      <Route path="/draw" component={DrawPage} />
      <Route path="/iot-analysis" component={IotAnalysisPage} />
      <Route path="/safety" component={SafetyPage} />
      <Route path="/export" component={ExportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
            <Navbar />
            <main className="flex-1 animate-in fade-in duration-300">
              <Toaster />
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </main>
            <Footer />
            
            {/* Advanced AI Chatbot */}
            <AdvancedChatbot />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
