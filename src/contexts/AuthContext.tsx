import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdminMode: boolean;
  setAdminMode: (val: boolean) => void;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  verifyAdminMode: (password: string) => Promise<boolean>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simple machine ID simulation
  const getMachineId = () => {
    let id = localStorage.getItem('ps_machine_id');
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('ps_machine_id', id);
    }
    return id;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('ps_admin_token');
      const machineId = getMachineId();

      if (token) {
        try {
          const res = await apiFetch('/api/auth/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, machineId })
          });
          if (res.ok) {
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error("Auth check failed:", error);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (password: string) => {
    const machineId = getMachineId();
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, machineId })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ps_admin_token', data.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    const token = localStorage.getItem('ps_admin_token');
    if (token) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
    localStorage.removeItem('ps_admin_token');
    setIsAuthenticated(false);
    setIsAdminMode(false);
  };

  const verifyAdminMode = async (password: string) => {
    try {
      const res = await apiFetch('/api/auth/verify-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        setIsAdminMode(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Admin verification failed:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdminMode, setAdminMode: setIsAdminMode, login, logout, verifyAdminMode, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
