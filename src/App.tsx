import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';

import MainLayout from './components/Layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { checkAuthSession } from './store/slices/authSlice';
import type { AppDispatch } from './store';
import { NotificationProvider } from './contexts/NotificationContext';

// ── Lazy load tất cả pages để giảm initial bundle size ────────────────────
const Login           = lazy(() => import('./pages/Login'));
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const ProductList     = lazy(() => import('./pages/Products/ProductList'));
const Inbound         = lazy(() => import('./pages/Inbound').then(m => ({ default: m.Inbound })));
const Outbound        = lazy(() => import('./pages/Outbound').then(m => ({ default: m.Outbound })));
const OrderList       = lazy(() => import('./pages/Orders/OrderList'));
const Reports         = lazy(() => import('./pages/Reports/Reports'));
const EmployeeList    = lazy(() => import('./pages/Employees/EmployeeList'));
const KpiGrades       = lazy(() => import('./pages/Employees/KpiGrades'));
const AdminRequests   = lazy(() => import('./pages/Employees/AdminRequests'));
const ChangePassword  = lazy(() => import('./pages/ChangePassword'));
const UserProfile     = lazy(() => import('./pages/UserProfile'));
const EmployeeReturns = lazy(() => import('./pages/EmployeeReturns/EmployeeReturns'));
const Settings        = lazy(() => import('./pages/Settings'));
const QRGenerator     = lazy(() => import('./pages/QRGenerator'));
const QRGeneratorHCM  = lazy(() => import('./pages/QRGeneratorHCM'));
const ActionHistory   = lazy(() => import('./pages/Reports/ActionHistory'));
const Audit           = lazy(() => import('./pages/Inventory/Audit'));
const InventoryReport = lazy(() => import('./pages/Inventory/InventoryReport'));
const DetailedOutboundReport = lazy(() => import('./pages/Inventory/DetailedOutboundReport'));
const MonthlySettlementReport = lazy(() => import('./pages/Inventory/MonthlySettlementReport'));
const GoodsSettlementReport = lazy(() => import('./pages/Inventory/GoodsSettlementReport'));
const AssetList          = lazy(() => import('./pages/Assets/AssetList'));
const AssetMonthlyReport = lazy(() => import('./pages/Assets/AssetMonthlyReport'));
const AssetDetailReport  = lazy(() => import('./pages/Assets/AssetDetailReport'));
const AssetBrokenReport  = lazy(() => import('./pages/Assets/AssetBrokenReport'));
const AssetHandoverBhl   = lazy(() => import('./pages/Assets/AssetHandoverBhl'));

// Zalo Module
const ZaloConfig     = lazy(() => import('./pages/Zalo/ZaloConfig'));
const ZaloBotManager = lazy(() => import('./pages/Zalo/ZaloBotManager'));
const ZaloTemplates  = lazy(() => import('./pages/Zalo/ZaloTemplates'));
const ZaloCampaigns  = lazy(() => import('./pages/Zalo/ZaloCampaigns'));
const ZaloLogs       = lazy(() => import('./pages/Zalo/ZaloLogs'));

const FullScreenScanner = lazy(() => import('./pages/FullScreenScanner'));

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
                            
                            <Route path="/scanner" element={<FullScreenScanner />} />

                            <Route path="/" element={<MainLayout />}>
                                <Route index element={<Dashboard />} />
                                
                                <Route element={<ProtectedRoute allowedPermissions={['orders.create', 'orders.view_own', 'orders.view_all']} />}>
                                    <Route path="orders" element={<OrderList />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['reports.view_all', 'reports.handover']} />}>
                                    <Route path="reports" element={<Reports />} />
                                    <Route path="action-history" element={<ActionHistory />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['outbound.view', 'outbound.create']} />}>
                                    <Route path="outbound" element={<Outbound />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['inventory.view', 'inventory.manage']} />}>
                                    <Route path="products" element={<ProductList />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['audit.view', 'audit.create']} />}>
                                    <Route path="audit" element={<Audit />} />
                                    <Route path="inventory-report" element={<InventoryReport />} />
                                    <Route path="detailed-outbound-report" element={<DetailedOutboundReport />} />
                                    <Route path="monthly-settlement" element={<MonthlySettlementReport />} />
                                    <Route path="goods-settlement" element={<GoodsSettlementReport />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['assets.view', 'assets.manage', 'assets.list_only', '*']} />}>
                                    <Route path="assets" element={<AssetList />} />
                                    <Route path="assets/handover-bhl" element={<AssetHandoverBhl />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['assets.view', 'assets.manage', '*']} />}>
                                    <Route path="assets/report-ccdc" element={<AssetMonthlyReport reportType="CCDC" />} />
                                    <Route path="assets/report-tbvp" element={<AssetMonthlyReport reportType="TBVP" />} />
                                    <Route path="assets/detail-ccdc" element={<AssetDetailReport reportType="CCDC" />} />
                                    <Route path="assets/detail-tbvp" element={<AssetDetailReport reportType="TBVP" />} />
                                    <Route path="assets/broken-report" element={<AssetBrokenReport />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['inbound.view', 'inbound.create']} />}>
                                    <Route path="inbound" element={<Inbound />} />
                                </Route>
                                
                                <Route element={<ProtectedRoute allowedPermissions={['qr.view']} />}>
                                    <Route path="qr-generator" element={<QRGenerator />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['qr_hcm.view']} />}>
                                    <Route path="qr-generator-hcm" element={<QRGeneratorHCM />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['employees.view', 'employees.manage']} />}>
                                    <Route path="employees" element={<EmployeeList />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
                                    <Route path="kpi-grades" element={<KpiGrades />} />
                                    <Route path="admin-requests" element={<AdminRequests />} />
                                </Route>

                                <Route path="profile" element={<UserProfile />} />

                                <Route element={<ProtectedRoute allowedPermissions={['returns.view', 'returns.create']} />}>
                                    <Route path="employee-returns" element={<EmployeeReturns />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedPermissions={['*']} />}>
                                    <Route path="settings" element={<Settings />} />
                                </Route>

                                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                                    <Route path="zalo/contacts" element={<ZaloBotManager />} />
                                    <Route path="zalo/config" element={<ZaloConfig />} />
                                    <Route path="zalo/templates" element={<ZaloTemplates />} />
                                    <Route path="zalo/campaigns" element={<ZaloCampaigns />} />
                                    <Route path="zalo/logs" element={<ZaloLogs />} />
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
