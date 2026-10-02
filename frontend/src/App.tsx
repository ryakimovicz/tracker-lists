import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { RouteGuard } from './components/RouteGuard';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Search } from './pages/Search';
import { AdminPanel } from './pages/AdminPanel';
import { Recommended } from './pages/Recommended';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';

import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { Social } from './pages/Social';
import { CreateGuide } from './pages/CreateGuide';
import { ViewGuide } from './pages/ViewGuide';
import { SettingsPage } from './pages/Settings';
import CustomizePage from './pages/Customize';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';

import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

import { CookieBanner } from './components/CookieBanner';
import { SuspendedAccountModal } from './components/SuspendedAccountModal';
import { RightSidebarAd } from './components/RightSidebarAd';

import { PathdLoader } from './components/PathdLoader';
import { initGlobalPrefetch } from './utils/prefetch';
import { ItemRouteModal } from './components/ItemRouteModal';
import { PostRouteModal } from './components/PostRouteModal';
import React, { useEffect } from 'react';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [contentMarginRight, setContentMarginRight] = React.useState<number>(0);
  const hasToken = Boolean(localStorage.getItem('access_token'));
  const location = useLocation();
  const state = location.state as { backgroundLocation?: any } | undefined;

  useEffect(() => {
    if (isAuthenticated) {
      initGlobalPrefetch();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const updateCentering = () => {
      const windowTotalWidth = window.outerWidth || window.innerWidth;
      const availableViewportWidth = window.innerWidth;
      const contentWidth = 1200;
      const sidebarWidth = 250;

      // Position in total browser window
      const leftInWindow = (windowTotalWidth - contentWidth) / 2;
      const rightInWindow = leftInWindow + contentWidth;

      // Check if centered-in-window fits comfortably:
      // Must not overlap left sidebar (left >= sidebarWidth)
      // and must not collide with right browser/DevTools edge (right <= availableViewportWidth)
      if (leftInWindow >= sidebarWidth && rightInWindow <= availableViewportWidth) {
        const requiredMarginRight = (availableViewportWidth - sidebarWidth) - (contentWidth + 2 * (leftInWindow - sidebarWidth));
        setContentMarginRight(Math.max(0, Math.round(requiredMarginRight)));
      } else {
        setContentMarginRight(0);
      }
    };

    updateCentering();
    window.addEventListener('resize', updateCentering);
    return () => window.removeEventListener('resize', updateCentering);
  }, []);

  return (
    <div className="app-container">
      <SuspendedAccountModal />
      <Sidebar />

      <main 
        className="main-content"
        style={{ '--main-content-margin-right': `${contentMarginRight}px` } as React.CSSProperties}
      >
        <Routes location={state?.backgroundLocation || location}>
            {/* Conditional homepage depending on authentication status */}
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Home />
                ) : isLoading && hasToken ? (
                  <PathdLoader fullScreen />
                ) : (
                  <Landing />
                )
              }
            />
            <Route path="/recommended" element={<Recommended />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            
            {/* Authenticated Routes */}
            <Route
              path="/settings"
              element={
                <RouteGuard>
                  <SettingsPage />
                </RouteGuard>
              }
            />
            <Route
              path="/customize"
              element={
                <RouteGuard>
                  <CustomizePage />
                </RouteGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <RouteGuard>
                  <Profile />
                </RouteGuard>
              }
            />
            <Route
              path="/user/:username"
              element={
                <RouteGuard>
                  <Profile />
                </RouteGuard>
              }
            />
            <Route
              path="/guide/:id"
              element={
                <RouteGuard>
                  <ViewGuide />
                </RouteGuard>
              }
            />
            <Route
              path="/social"
              element={
                <RouteGuard>
                  <Social />
                </RouteGuard>
              }
            />
            <Route
              path="/create"
              element={
                <RouteGuard>
                  <CreateGuide />
                </RouteGuard>
              }
            />
            <Route
              path="/search"
              element={
                <RouteGuard>
                  <Search />
                </RouteGuard>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <RouteGuard requireAdmin>
                  <AdminPanel />
                </RouteGuard>
              }
            />

            {/* Direct item view when accessed without backgroundLocation */}
            <Route
              path="/item/:type/:id"
              element={
                <RouteGuard>
                  <Search />
                </RouteGuard>
              }
            />

            {/* Direct post / activity view when accessed without backgroundLocation */}
            <Route
              path="/post/:id"
              element={
                <RouteGuard>
                  <Social />
                </RouteGuard>
              }
            />
          </Routes>

          {/* Modal overlay route when navigating from within the app */}
          {state?.backgroundLocation && (
            <Routes>
              <Route
                path="/item/:type/:id"
                element={<ItemRouteModal />}
              />
              <Route
                path="/post/:id"
                element={<PostRouteModal />}
              />
            </Routes>
          )}

          {/* Also mount ItemRouteModal if on /item/:type/:id directly over fallback background */}
          {!state?.backgroundLocation && location.pathname.startsWith('/item/') && (
            <ItemRouteModal />
          )}

          {/* Also mount PostRouteModal if on /post/:id directly over fallback background */}
          {!state?.backgroundLocation && location.pathname.startsWith('/post/') && (
            <PostRouteModal />
          )}
        </main>
        <RightSidebarAd />
        <CookieBanner />
      </div>
  );
}

function AppRoutes() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

// App Version: Pathd v0.9.8 Beta
export default App;


