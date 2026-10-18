import { Link, useLocation } from "wouter";
import { GraduationCap, User, LogOut, Search, PlusCircle, Car, ShieldAlert, Leaf, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/safety/verification-badge";
import { isAuthenticated, removeAuthToken, getAuthHeaders } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function Header() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isSosLoading, setIsSosLoading] = useState(false);
  const isAuth = isAuthenticated();

  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: isAuth,
    queryFn: async () => {
      const rawHeaders = getAuthHeaders() || {};
      const headers = Object.fromEntries(
        Object.entries(rawHeaders).filter(([, v]) => v != null)
      ) as Record<string, string>;

      const response = await fetch('/api/auth/me', { headers });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const handleLogout = () => {
    removeAuthToken();
    navigate('/');
  };

  const handleTriggerSos = async () => {
    if (!isAuth) {
      navigate('/login');
      return;
    }
    setIsSosLoading(true);
    try {
      await apiRequest('POST', '/api/sos', { message: 'Emergency SOS Triggered from Header' });
      toast({
        title: '🚨 Emergency SOS Sent!',
        description: 'Your SOS signal was broadcast to campus emergency contacts.',
        variant: 'destructive',
      });
    } catch (err: any) {
      toast({ title: 'SOS Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSosLoading(false);
    }
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="bg-background/95 backdrop-blur-md border-b border-border/80 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2.5 hover:opacity-90 transition-opacity">
              <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-primary">UniRide</h1>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/" className={`text-sm font-medium transition-colors ${location === '/' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                Dashboard
              </Link>
              <Link href="/search" className={`text-sm font-medium transition-colors ${location === '/search' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                Find Rides
              </Link>
              <Link href="/offer" className={`text-sm font-medium transition-colors ${location === '/offer' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                Offer a Ride
              </Link>
              {isAuth && (
                <Link href="/my-rides" className={`text-sm font-medium transition-colors ${location === '/my-rides' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                  My Rides
                </Link>
              )}
            </nav>

            <div className="flex items-center space-x-3">
              {/* SOS Emergency Button */}
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 font-semibold shadow-sm animate-pulse"
                onClick={handleTriggerSos}
                disabled={isSosLoading}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>SOS</span>
              </Button>

              {isAuth && user ? (
                <div className="flex items-center space-x-2">
                  <VerificationBadge isVerified={user.isVerified ?? true} size="sm" showText={false} />
                  <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="gap-1.5 font-medium">
                    <User className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">{user?.fullName?.split(' ')[0] || 'User'}</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign Out">
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm">Login</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="default" size="sm">Sign Up</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border px-4 py-2 flex justify-around items-center shadow-lg">
        <Link href="/" className={`flex flex-col items-center gap-1 ${location === '/' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <HomeIcon className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </Link>
        <Link href="/search" className={`flex flex-col items-center gap-1 ${location === '/search' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <Search className="w-5 h-5" />
          <span className="text-[10px]">Find</span>
        </Link>
        <Link href="/offer" className={`flex flex-col items-center gap-1 ${location === '/offer' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px]">Offer</span>
        </Link>
        {isAuth && (
          <Link href="/my-rides" className={`flex flex-col items-center gap-1 ${location === '/my-rides' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <Car className="w-5 h-5" />
            <span className="text-[10px]">My Rides</span>
          </Link>
        )}
        <Link href="/profile" className={`flex flex-col items-center gap-1 ${location === '/profile' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <Leaf className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
    </>
  );
}
