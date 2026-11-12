/**
 * Top-level React Router map for the public site and authenticated account area.
 * Account routes are wrapped in {@link ProtectedRoute}; everything else sits under {@link PublicLayout}.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Import named exports from '../components/layout/PublicLayout'.
import { PublicLayout } from '../components/layout/PublicLayout';
// Import named exports from '../auth/ProtectedRoute'.
import { ProtectedRoute } from '../auth/ProtectedRoute';
// Import named exports from '../pages/public/HomePage'.
import { HomePage } from '../pages/public/HomePage';
// Import named exports from '../pages/public/SearchResultsPage'.
import { SearchResultsPage } from '../pages/public/SearchResultsPage';
// Import named exports from '../pages/public/CarDetailPage'.
import { CarDetailPage } from '../pages/public/CarDetailPage';
// Import named exports from '../pages/public/OrderPage'.
import { OrderPage } from '../pages/public/OrderPage';
// Import named exports from '../pages/public/CheckoutPage'.
import { CheckoutPage } from '../pages/public/CheckoutPage';
// Import named exports from '../pages/public/CheckoutSuccessPage'.
import { CheckoutSuccessPage } from '../pages/public/CheckoutSuccessPage';
// Import named exports from '../pages/public/CheckoutCancelPage'.
import { CheckoutCancelPage } from '../pages/public/CheckoutCancelPage';
// Import named exports from '../pages/auth/LoginPage'.
import { LoginPage } from '../pages/auth/LoginPage';
// Import named exports from '../pages/auth/SignupPage'.
import { SignupPage } from '../pages/auth/SignupPage';
// Import named exports from '../pages/auth/VerifyEmailPage'.
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
// Import named exports from '../pages/account/AccountDashboardPage'.
import { AccountDashboardPage } from '../pages/account/AccountDashboardPage';
// Import named exports from '../pages/account/AccountReservationsPage'.
import { AccountReservationsPage } from '../pages/account/AccountReservationsPage';
// Import named exports from '../pages/account/AccountReservationDetailPage'.
import { AccountReservationDetailPage } from '../pages/account/AccountReservationDetailPage';
// Import named exports from '../pages/account/AccountDocumentsPage'.
import { AccountDocumentsPage } from '../pages/account/AccountDocumentsPage';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  AboutPage,
  // Contribute this line to the enclosing declaration or statement.
  FaqPage,
  // Contribute this line to the enclosing declaration or statement.
  TermsPage,
  // Contribute this line to the enclosing declaration or statement.
  PrivacyPage,
  // Contribute this line to the enclosing declaration or statement.
  HowToBookPage,
  // Contribute this line to the enclosing declaration or statement.
  SupportPage,
  // Contribute this line to the enclosing declaration or statement.
  ContactPage,
// Contribute this line to the enclosing declaration or statement.
} from '../pages/static/StaticPages';
// Import named exports from '../pages/NotFoundPage'.
import { NotFoundPage } from '../pages/NotFoundPage';
// Import named exports from './ScrollToTop'.
import { ScrollToTop } from './ScrollToTop';

/**
 * Mount the browser router and declare all public + account routes.
 *
 * @returns The app’s route tree under {@link PublicLayout}.
 */
export function AppRoutes() {
  // Return control to the caller with the following value.
  return (
    <BrowserRouter>
      <ScrollToTop />
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
