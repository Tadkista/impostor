import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="p-4 text-center text-muted">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <Outlet />;
}
