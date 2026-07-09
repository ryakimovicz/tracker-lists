import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
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

import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            {/* Conditional homepage depending on authentication status */}
            <Route path="/" element={isAuthenticated ? <Home /> : <Landing />} />
            <Route path="/recommended" element={<Recommended />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Authenticated Routes */}
            <Route
              path="/profile"
              element={
                <RouteGuard>
                  <Profile />
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
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
