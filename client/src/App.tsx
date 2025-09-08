import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import Header from "@/components/layout/header";
import Home from "@/pages/home";
import Register from "@/pages/auth/register";
import Login from "@/pages/auth/login";
import SearchRides from "@/pages/rides/search";
import OfferRide from "@/pages/rides/offer";
import MyRides from "@/pages/rides/my-rides";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { isAuthenticated } from "@/lib/auth";

function Router() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());

  useEffect(() => {
    const checkAuth = () => setIsAuth(isAuthenticated());
    checkAuth();
    
    // Listen for storage changes (logout from another tab)
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route path="/search" component={SearchRides} />
        <Route path="/offer" component={OfferRide} />
        <Route path="/my-rides" component={MyRides} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
