import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { Social } from './pages/Social';
import { CreateGuide } from './pages/CreateGuide';
import { ViewGuide } from './pages/ViewGuide';
import { SettingsPage } from './pages/Settings';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';

import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '831175761004-j5as0nr5ls0pmerajp7ldn725h2dpb00.apps.googleusercontent.com';

import { CookieBanner } from './components/CookieBanner';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            {/* Conditional homepage depending on authentication status */}
            <Route path="/" element={isAuthenticated ? <Home /> : <Landing />} />
            <Route path="/recommended" element={<Recommended />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
              path="/profile"
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
          </Routes>
        </main>
        <CookieBanner />
      </div>
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

export default App;

