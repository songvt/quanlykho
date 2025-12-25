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
        {/* Change Password Route - No Layout (or nested if desired, but standalone prevents menu clicks) */}
        {/* If we want Layout but no navigation, we'd need a Layout variant. 
             But keeping it inside MainLayout allows Logout. 
             MainLayout forces redirect if not changed. 
             So we need to exclude MainLayout if we want to Isolate it? 
             But header is useful. 
             If MainLayout redirects / -> /change-password, then /change-password works.
             So /change-password can use MainLayout! 
             BUT I put it parallel. Let's make it parallel for simplicity to be safe from loop. 
         */}
        <Route path="/change-password" element={<ChangePassword />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="reports" element={<Reports />} />
          <Route path="outbound" element={<Outbound />} />

          {/* Admin only routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
            <Route path="products" element={<ProductList />} />
            <Route path="inbound" element={<Inbound />} />
            <Route path="employees" element={<EmployeeList />} />
          </Route>

          <Route path="profile" element={<UserProfile />} />
          <Route path="employee-returns" element={<EmployeeReturns />} />

          <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
