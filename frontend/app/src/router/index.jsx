import React from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { ProtectedRoute } from '../components/common/ProtectedRoute';
import LoginPage from '../pages/auth/LoginPage';
import NotFound from '../pages/NotFound';
import AdminLayout from '../layouts/AdminLayout';
import ClientLayout from '../layouts/ClientLayout';
import Dashboard from '../pages/admin/Dashboard';
import CreateCollectible from '../pages/admin/CreateCollectible';
import ApplicationApprovals from '../pages/admin/ApplicationApprovals';
import TransferApprovals from '../pages/admin/TransferApprovals';
import UserManagement from '../pages/admin/UserManagement';
import ClientDashboard from '../pages/client/Dashboard';
import ApplyCollectible from '../pages/client/ApplyCollectible';
import MyCollectibles from '../pages/client/MyCollectibles';
import CollectibleTransfer from '../pages/client/CollectibleTransfer';
import CollectibleApplication from '../pages/client/CollectibleApplication';
import SearchCollectibles from '../pages/admin/SearchCollectibles';
import IcbcAuthorize from '../pages/auth/IcbcAuthorize';

const AdminRoutes = () => (
  <ProtectedRoute roles={['SUPER_ADMIN', 'ICBC_ADMIN', 'BRAND_ADMIN']}>
    <AdminLayout />
  </ProtectedRoute>
);

const ClientRoutes = () => (
  <ProtectedRoute roles={['USER', 'CLIENT', 'CUSTOMER', 'BRAND_CLIENT']}>
    <ClientLayout />
  </ProtectedRoute>
);

export const AppRouter = () => {
  const element = useRoutes([
    { path: '/', element: <Navigate to="/login" replace /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/icbc-authorize', element: <IcbcAuthorize /> },
    {
      path: '/admin',
      element: <AdminRoutes />,
      children: [
    { index: true, element: <Dashboard /> },
    { path: 'create', element: <CreateCollectible /> },
    { path: 'applications', element: <ApplicationApprovals /> },
    { path: 'transfers', element: <TransferApprovals /> },
    { path: 'users', element: <UserManagement /> },
    { path: 'search', element: <SearchCollectibles /> }
      ]
    },
    {
      path: '/client',
      element: <ClientRoutes />,
      children: [
    { index: true, element: <ClientDashboard /> },
    { path: 'apply', element: <ApplyCollectible /> },
    { path: 'applications/new', element: <CollectibleApplication /> },
  { path: 'my-collectibles', element: <MyCollectibles /> },
  { path: 'transfer', element: <CollectibleTransfer /> }
      ]
    },
    { path: '*', element: <NotFound /> }
  ]);

  return element;
};
