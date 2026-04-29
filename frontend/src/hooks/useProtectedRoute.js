import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to protect routes that require authentication and specific roles
 * Usage: useProtectedRoute('customer') or useProtectedRoute(['customer', 'admin'])
 */
export function useProtectedRoute(allowedRoles = null) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Check if user is authenticated
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Check if user has allowed role
      if (allowedRoles) {
        const rolesArray = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((role) =>
          String(role).toLowerCase(),
        );
        const currentRole = String(user.role?.name || '').toLowerCase();
        if (!rolesArray.includes(currentRole)) {
          router.push('/');
        }
      }
    }
  }, [user, loading, router, allowedRoles]);

  return { user, loading };
}

export default useProtectedRoute;
