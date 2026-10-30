import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import InventoryProfit from './pages/InventoryProfit';
import Reports from './pages/Reports';
import Reservations from './pages/Reservations';
import { DailyNotes } from './pages/DailyNotes';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { FinancialVisibilityProvider } from './contexts/FinancialVisibilityContext';
import { SessionProvider } from './contexts/SessionContext';
import SplashScreen from './components/SplashScreen';
import { cn } from './lib/utils';
import './i18n';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-colors duration-500",
        theme === 'dark' ? "bg-[#0a0a0a]" : "bg-white"
      )}>
        <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdminMode } = useAuth();

  if (!isAdminMode) {
    return <Navigate to="/tables" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ThemeProvider>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <AuthProvider>
          <FinancialVisibilityProvider>
            <SessionProvider>
              <HashRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/tables" replace />} />
                    <Route path="dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                    <Route path="tables" element={<Tables />} />
                    <Route path="products" element={<Products />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="inventory-profit" element={<AdminRoute><InventoryProfit /></AdminRoute>} />
                    <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
                    <Route path="daily-notes" element={<DailyNotes />} />
                    <Route path="reservations" element={<Reservations />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/tables" replace />} />
                </Routes>
              </HashRouter>
            </SessionProvider>
          </FinancialVisibilityProvider>
        </AuthProvider>
      )}
    </ThemeProvider>
  );
}
