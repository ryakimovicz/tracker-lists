import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { RouteGuard } from './components/RouteGuard';
// Lazy-loaded page components for Code-Splitting and instant initial page load
const Landing = React.lazy(() => import('./pages/Landing'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Search = React.lazy(() => import('./pages/Search'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const Recommended = React.lazy(() => import('./pages/Recommended'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'));

const Home = React.lazy(() => import('./pages/Home'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Social = React.lazy(() => import('./pages/Social'));
const CreateGuide = React.lazy(() => import('./pages/CreateGuide'));
const ViewGuide = React.lazy(() => import('./pages/ViewGuide'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const CustomizePage = React.lazy(() => import('./pages/Customize'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { getProfileTheme } from './utils/profileThemes';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineDetector } from './components/OfflineDetector';
import { CookieBanner } from './components/CookieBanner';
import { SuspendedAccountModal } from './components/SuspendedAccountModal';
import { RightSidebarAd } from './components/RightSidebarAd';

import { PathdLoader } from './components/PathdLoader';
import { initGlobalPrefetch } from './utils/prefetch';
import { ItemRouteModal } from './components/ItemRouteModal';
import { PostRouteModal } from './components/PostRouteModal';
import { MusicRouteModal } from './components/MusicRouteModal';
import { PremiumRouteModal } from './components/PremiumRouteModal';
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import React, { useEffect, Suspense } from 'react';

function AppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
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

  const appProfileTheme = React.useMemo(() => {
    if (user?.is_pro && user?.profile_color) {
      return getProfileTheme(user.profile_color, isLight);
    }
    return null;
  }, [user?.is_pro, user?.profile_color, isLight]);

  // Synchronize custom accent / theme variables to document.documentElement
  // so portals, modals (e.g. ActivityModal, KlipyPicker), tooltips and roots inherit the custom accent
  useEffect(() => {
    const root = document.documentElement;
    const vars = appProfileTheme?.cssVariables as Record<string, string> | undefined;

    const themeVarKeys = [
      '--accent-primary',
      '--accent-secondary',
      '--accent-hover',
      '--border-color',
      '--border-glow',
      '--btn-glow',
      '--btn-glow-hover',
      '--accent-text',
      '--accent-text-hover'
    ];

    if (vars) {
      Object.entries(vars).forEach(([key, value]) => {
        if (value) root.style.setProperty(key, String(value));
      });
    } else {
      themeVarKeys.forEach((key) => root.style.removeProperty(key));
    }

    return () => {
      themeVarKeys.forEach((key) => root.style.removeProperty(key));
    };
  }, [appProfileTheme]);

  return (
    <div 
      className="app-container"
      style={appProfileTheme?.cssVariables}
    >
      <OfflineDetector />
      <SuspendedAccountModal />
      <Sidebar />
      <MobileHeader />

      <main 
        className="main-content"
        style={{ '--main-content-margin-right': `${contentMarginRight}px` } as React.CSSProperties}
      >
        <ErrorBoundary>
          <Suspense fallback={<PathdLoader fullScreen />}>
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
            <Route
              path="/premium"
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
            <Route
              path="/pro"
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
            {/* Direct music view when accessed without backgroundLocation */}
            <Route
              path="/music/artist/:artist"
              element={
                <RouteGuard>
                  <Profile />
                </RouteGuard>
              }
            />
            {/* 404 Catch-All Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>

      {/* Modal overlay route when navigating from within the app */}
      {state?.backgroundLocation && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <Routes>
              <Route
                path="/item/:type/:id"
                element={<ItemRouteModal key={location.pathname} />}
              />
              <Route
                path="/post/:id"
                element={<PostRouteModal key={location.pathname} />}
              />
              <Route
                path="/music/artist/:artist"
                element={<MusicRouteModal key={location.pathname} />}
              />
              <Route
                path="/music/:type/:artist/:name"
                element={<MusicRouteModal key={location.pathname} />}
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      )}

          {/* Also mount ItemRouteModal, PostRouteModal or MusicRouteModal if accessed directly over fallback background */}
          {!state?.backgroundLocation && (location.pathname.startsWith('/item/') || location.pathname.startsWith('/post/') || location.pathname.startsWith('/music/')) && (
            <Routes>
              <Route
                path="/item/:type/:id"
                element={<ItemRouteModal key={location.pathname} />}
              />
              <Route
                path="/post/:id"
                element={<PostRouteModal key={location.pathname} />}
              />
              <Route
                path="/music/artist/:artist"
                element={<MusicRouteModal key={location.pathname} />}
              />
              <Route
                path="/music/:type/:artist/:name"
                element={<MusicRouteModal key={location.pathname} />}
              />
            </Routes>
          )}
        </main>
        <PremiumRouteModal />
        <RightSidebarAd />
        <CookieBanner />
        <MobileBottomNav />
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

// App Version: Pathd v0.9.9 Beta
export default App;


