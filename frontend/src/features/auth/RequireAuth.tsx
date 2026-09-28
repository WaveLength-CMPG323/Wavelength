import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../data/AuthContext';

// Guests can browse the ocean and play music, but anything that would save
// state (profile, chat) redirects to the login screen. Waits for the
// initial /auth/me session check to finish before deciding, so a logged-in
// user isn't bounced to /login for a flash while that request is in flight.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
