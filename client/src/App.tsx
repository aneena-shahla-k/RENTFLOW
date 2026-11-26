import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthProvider } from './store/authContext';
import { CartProvider } from './store/cartContext';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Public & Auth Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';

// Admin Pages
import { OnboardingWizardPage } from './pages/admin/OnboardingWizardPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { InventoryPage } from './pages/admin/InventoryPage';
import { CategoriesPage } from './pages/admin/CategoriesPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { ReturnsPage } from './pages/admin/ReturnsPage';
import { DeliveriesPage } from './pages/admin/DeliveriesPage';
import { CustomersPage } from './pages/admin/CustomersPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SupportReviewsPage } from './pages/admin/SupportReviewsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

// Customer Pages
import { CustomerOverviewPage } from './pages/customer/CustomerOverviewPage';
import { CatalogPage } from './pages/customer/CatalogPage';
import { ProductDetailPage } from './pages/customer/ProductDetailPage';
import { CartCheckoutPage } from './pages/customer/CartCheckoutPage';
import { CustomerBookingsPage } from './pages/customer/CustomerBookingsPage';
import { CustomerPaymentsInvoicesPage } from './pages/customer/CustomerPaymentsInvoicesPage';
import { CustomerProfilePage } from './pages/customer/CustomerProfilePage';
import { CustomerSupportPage } from './pages/customer/CustomerSupportPage';

// Shared & Super Admin
import { BookingDetailPage } from './pages/shared/BookingDetailPage';
import { SuperAdminPage } from './pages/superadmin/SuperAdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
      refetchOnWindowFocus: false,
    },
  },
});

const COMPANY_ROLES = ['company_owner', 'company_admin', 'rental_staff'] as const;

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/catalog" element={<CatalogPage isPublic />} />
                <Route path="/catalog/:id" element={<ProductDetailPage isPublic />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                {/* Company Admin & Staff Routes */}
                <Route
                  path="/admin/onboarding"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <OnboardingWizardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/inventory"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <InventoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/categories"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <CategoriesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/bookings"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <AdminBookingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/bookings/:id"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <BookingDetailPage mode="admin" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/returns"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <ReturnsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/deliveries"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <DeliveriesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/customers"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <CustomersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/support"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <SupportReviewsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Customer Portal Routes */}
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CustomerOverviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/catalog"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CatalogPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/products/:id"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <ProductDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/cart"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CartCheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/bookings"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CustomerBookingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/bookings/:id"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <BookingDetailPage mode="customer" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/payments"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CustomerPaymentsInvoicesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/profile"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CustomerProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/support"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <CustomerSupportPage />
                    </ProtectedRoute>
                  }
                />

                {/* Platform Super Admin Route */}
                <Route
                  path="/superadmin"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <SuperAdminPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <Toaster position="top-right" richColors closeButton />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
