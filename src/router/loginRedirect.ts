import type { Location } from 'react-router-dom';

/** Original destination path and query passed when a protected route redirects to login. */
export type LoginRedirectState = { from?: Pick<Location, 'pathname' | 'search'> };

/** Return to the original destination after login, defaulting to the dashboard, never login
 * itself. */
export function resolveLoginRedirect(state: unknown): string {
  const from = (state as LoginRedirectState | null)?.from;
  const pathname = from?.pathname;
  if (!pathname || pathname === '/login') return '/';
  return `${pathname}${from?.search ?? ''}`;
}
