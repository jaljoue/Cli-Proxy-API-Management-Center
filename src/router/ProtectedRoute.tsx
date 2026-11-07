import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import type { LoginRedirectState } from './loginRedirect';

/**
 * Send sessions that have not been verified to the login page.
 * Users with saved passwords auto-login through the splash and reveal their original destination.
 * Users without a restorable session see the login form directly.
 */
export function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    const state: LoginRedirectState = {
      from: { pathname: location.pathname, search: location.search },
    };
    return <Navigate to="/login" replace state={state} />;
  }

  return children;
}
