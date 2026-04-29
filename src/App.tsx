import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';

import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { checkAuthSession } from './store/slices/authSlice';
import type { AppDispatch } from './store';
import { NotificationProvider } from './contexts/NotificationContext';

// ── Lazy load tất cả pages để giảm initial bundle size ────────────────────
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const ProductList     = lazy(() => import('./pages/Products/ProductList'));
const Inbound         = lazy(() => import('./pages/Inbound').then(m => ({ default: m.Inbound })));
const Outbound        = lazy(() => import('./pages/Outbound').then(m => ({ default: m.Outbound })));
const OrderList       = lazy(() => import('./pages/Orders/OrderList'));
const Reports         = lazy(() => import('./pages/Reports/Reports'));
const EmployeeList    = lazy(() => import('./pages/Employees/EmployeeList'));
const ChangePassword  = lazy(() => import('./pages/ChangePassword'));
const UserProfile     = lazy(() => import('./pages/UserProfile'));
const EmployeeReturns = lazy(() => import('./pages/EmployeeReturns/EmployeeReturns'));
const Settings        = lazy(() => import('./pages/Settings'));
const QRGenerator     = lazy(() => import('./pages/QRGenerator'));


const NotFound = lazy(() => import('./pages/NotFound').catch(() => ({
    default: () => <Box p={6} textAlign="center" sx={{ color: 'text.secondary', fontSize: 24 }}>404 — Không tìm thấy trang</Box>
})));

// ── Fallback loading khi lazy chunk đang tải ───────────────────────────────
const PageLoader = () => (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={40} />
    </Box>
);

function App() {
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        dispatch(checkAuthSession());
    }, [dispatch]);

    return (
        <ErrorBoundary>
            <NotificationProvider>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute />}>
                            <Route path="/change-password" element={<ChangePassword />} />

                            <Route path="/" element={<MainLayout />}>
                                {/* ... rest remains same ... */}
                                <Route index element={<Dashboard />} />
                                
                                <Route element={<ProtectedRoute allowedPermissions={['orders.create', 'orders.view_own', 'orders.view_all']} />}>
                                    <Route path="orders" element={<OrderList />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['reports.view_all', 'reports.handover']} />}>
                                    <Route path="reports" element={<Reports />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['outbound.view', 'outbound.create']} />}>
                                    <Route path="outbound" element={<Outbound />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['inventory.view', 'inventory.manage']} />}>
                                    <Route path="products" element={<ProductList />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['inbound.view', 'inbound.create']} />}>
                                    <Route path="inbound" element={<Inbound />} />
                                    <Route path="qr-generator" element={<QRGenerator />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['employees.view', 'employees.manage']} />}>
                                    <Route path="employees" element={<EmployeeList />} />
                                </Route>

                                <Route path="profile" element={<UserProfile />} />

                                <Route element={<ProtectedRoute allowedPermissions={['returns.view', 'returns.create']} />}>
                                    <Route path="employee-returns" element={<EmployeeReturns />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['*']} />}>
                                    <Route path="settings" element={<Settings />} />
                                </Route>

                                <Route path="*" element={<NotFound />} />
                            </Route>
                        </Route>
                    </Routes>
                </Suspense>
            </NotificationProvider>
        </ErrorBoundary>
    );
}

export default App;
