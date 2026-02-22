import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Typography } from '@mui/material';

import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/Products/ProductList';
import { Inbound } from './pages/Inbound';
import { Outbound } from './pages/Outbound';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { checkAuthSession } from './store/slices/authSlice';
import type { AppDispatch } from './store';

import OrderList from './pages/Orders/OrderList';
import Reports from './pages/Reports/Reports';
import EmployeeList from './pages/Employees/EmployeeList';
import ChangePassword from './pages/ChangePassword';
import UserProfile from './pages/UserProfile';
import EmployeeReturns from './pages/EmployeeReturns/EmployeeReturns';
import Settings from './pages/Settings';

const NotFound = () => <Typography variant="h4">404 - Không tìm thấy trang</Typography>;

function App() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(checkAuthSession());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/change-password" element={<ChangePassword />} />

        <Route path="/" element={<MainLayout />}>
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
  );
}

export default App;
