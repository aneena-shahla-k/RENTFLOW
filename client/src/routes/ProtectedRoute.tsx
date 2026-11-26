import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authContext';
import { UserRole } from '../types';
import { DashboardSkeleton } from '../components/common/Skeleton';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export function getHomePathForRole(role?: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/superadmin';
    case 'company_owner':
    case 'company_admin':
    case 'rental_staff':
      return '/admin';
    case 'customer':
      return '/customer';
    default:
      return '/login';
  }
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
