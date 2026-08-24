import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/navigation/Navigation";

export default function AuthRequired() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    // Only redirect after initial loading is complete and if not authenticated
    if (!isLoading && !isAuthenticated) {
      // Save the location they were trying to access for redirecting after login
      navigate("/login", { 
        state: { from: location.pathname },
        replace: true 
      });
    }
  }, [navigate, location, isAuthenticated, isLoading]);

  // Show nothing while checking auth status
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  // If authenticated, render the child routes
  return isAuthenticated ? (
    <>
      <Navigation />
      <Outlet />
    </>
  ) : null;
}