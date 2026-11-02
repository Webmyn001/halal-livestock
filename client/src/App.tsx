import { Navigate, Route, Routes } from 'react-router-dom';
import { Footer } from './components/layout/Footer';
import { dashboardPath, Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Spinner } from './components/common/Button';
import { useAuth } from './hooks/useAuth';
import { DashboardPage } from './pages/Dashboard';
import { NotFoundPage } from './pages/NotFound';
import { BuyerDashboardPage } from './pages/buyer/BuyerDashboard';
import { FarmerDashboardPage } from './pages/farmer/FarmerDashboard';
import { PostLivestockPage } from './pages/farmer/PostLivestock';
import { ContactPage } from './pages/public/Contact';
import { ForgotPasswordPage } from './pages/public/ForgotPassword';
import { HomePage } from './pages/public/Home';
import { HowItWorksPage } from './pages/public/HowItWorks';
import { ListingDetailPage } from './pages/public/ListingDetail';
import { LoginPage } from './pages/public/Login';
import { MarketplacePage } from './pages/public/Marketplace';
import { RegisterPage } from './pages/public/Register';
import { ResetPasswordPage } from './pages/public/ResetPassword';
import { VerifyEmailPage } from './pages/public/VerifyEmail';

/** Keeps signed-in users away from the login/register screens. */
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="grid min-h-[50vh] place-items-center text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }

  return status === 'authenticated' && user ? <Navigate to={dashboardPath(user.role)} replace /> : <>{children}</>;
}

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/:id" element={<ListingDetailPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/buyer/dashboard"
            element={
              <ProtectedRoute roles={['buyer']}>
                <BuyerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farmer/dashboard"
            element={
              <ProtectedRoute roles={['farmer']}>
                <FarmerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farmer/post-livestock"
            element={
              <ProtectedRoute roles={['farmer']}>
                <PostLivestockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute roles={['admin']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
