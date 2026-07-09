import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { RouteGuard } from './components/RouteGuard';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Search } from './pages/Search';
import { AdminPanel } from './pages/AdminPanel';

import { LanguageProvider } from './context/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Authenticated Routes */}
              <Route
                path="/dashboard"
                element={
                  <RouteGuard>
                    <Dashboard />
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
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
