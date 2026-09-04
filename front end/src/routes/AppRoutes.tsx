import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { HomePage } from '../pages/public/HomePage';
import { SearchResultsPage } from '../pages/public/SearchResultsPage';
import { CarDetailPage } from '../pages/public/CarDetailPage';
import { OrderPage } from '../pages/public/OrderPage';
import { CheckoutPage } from '../pages/public/CheckoutPage';
import { CheckoutSuccessPage } from '../pages/public/CheckoutSuccessPage';
import { CheckoutCancelPage } from '../pages/public/CheckoutCancelPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { AccountDashboardPage } from '../pages/account/AccountDashboardPage';
import { AccountReservationsPage } from '../pages/account/AccountReservationsPage';
import { AccountReservationDetailPage } from '../pages/account/AccountReservationDetailPage';
import { AccountDocumentsPage } from '../pages/account/AccountDocumentsPage';
import {
  AboutPage,
  FaqPage,
  TermsPage,
  PrivacyPage,
  HowToBookPage,
  SupportPage,
  ContactPage,
} from '../pages/static/StaticPages';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchResultsPage />} />
          <Route path="cars/:carId" element={<CarDetailPage />} />
          <Route path="order/:carId" element={<OrderPage />} />
          <Route path="checkout/:carId" element={<CheckoutPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route
            path="account"
            element={
              <ProtectedRoute>
                <AccountDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/reservations"
            element={
              <ProtectedRoute>
                <AccountReservationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/reservations/:id"
            element={
              <ProtectedRoute>
                <AccountReservationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/documents"
            element={
              <ProtectedRoute>
                <AccountDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route path="about" element={<AboutPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="how-to-book" element={<HowToBookPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
