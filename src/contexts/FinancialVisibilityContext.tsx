import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface FinancialVisibilityContextType {
  isVisible: boolean;
  reveal: (password: string) => Promise<boolean>;
  hide: () => void;
}

const FinancialVisibilityContext = createContext<FinancialVisibilityContextType | undefined>(undefined);

export const FinancialVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const reveal = async (password: string): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/settings/report-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsVisible(true);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const hide = () => setIsVisible(false);

  return (
    <FinancialVisibilityContext.Provider value={{ isVisible, reveal, hide }}>
      {children}
    </FinancialVisibilityContext.Provider>
  );
};

export const useFinancialVisibility = () => {
  const context = useContext(FinancialVisibilityContext);
  if (context === undefined) {
    throw new Error('useFinancialVisibility must be used within a FinancialVisibilityProvider');
  }
  return context;
};
