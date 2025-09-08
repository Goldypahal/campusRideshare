import { Link, useLocation } from "wouter";
import { GraduationCap, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/safety/verification-badge";
import { isAuthenticated, removeAuthToken } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

export default function Header() {
  const [location, navigate] = useLocation();
  const isAuth = isAuthenticated();

  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: isAuth,
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const handleLogout = () => {
    removeAuthToken();
    navigate('/');
    window.location.reload();
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80">
            <div className="safety-indicator p-2 rounded-lg">
              <GraduationCap className="text-primary-foreground text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">UniRide</h1>
          </Link>
          
          <nav className="hidden md:flex space-x-6">
            <Link href="/search">
              <a className={`text-muted-foreground hover:text-foreground transition-colors ${
                location === '/search' ? 'text-foreground font-medium' : ''
              }`} data-testid="link-search">
                Find Rides
              </a>
            </Link>
            <Link href="/offer">
              <a className={`text-muted-foreground hover:text-foreground transition-colors ${
                location === '/offer' ? 'text-foreground font-medium' : ''
              }`} data-testid="link-offer">
                Offer Ride
              </a>
            </Link>
            {isAuth && (
              <Link href="/my-rides">
                <a className={`text-muted-foreground hover:text-foreground transition-colors ${
                  location === '/my-rides' ? 'text-foreground font-medium' : ''
                }`} data-testid="link-my-rides">
                  My Rides
                </a>
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-3">
            {isAuth && user ? (
              <>
                {user.isVerified && <VerificationBadge />}
                <Link href="/profile">
                  <Button variant="ghost" size="sm" data-testid="button-profile">
                    <User className="h-4 w-4 mr-1" />
                    {user.fullName.split(' ')[0]}
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="button-login">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" size="sm" data-testid="button-register">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
