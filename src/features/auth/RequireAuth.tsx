import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../data/AuthContext';

// Guests can browse the ocean and play music, but anything that would save
// state (profile, chat) redirects to the login screen.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
