import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import { Toaster } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

const Layout: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn(
      "min-h-screen flex font-sans transition-colors duration-200",
      theme === 'dark' ? "bg-[#050505] text-zinc-100" : "bg-slate-50 text-slate-900"
    )}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main 
        className="flex-1 transition-[margin] duration-300 flex flex-col min-h-screen"
        style={{ marginLeft: collapsed ? '5rem' : '16rem' }}
      >
        <div className="flex-1 p-10 lg:p-14">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </div>
        <footer className="p-10 lg:p-14 pt-0 text-center">
          <div className={cn(
            "max-w-[1400px] mx-auto w-full border-t pt-8",
            theme === 'dark' ? "border-white/[0.05]" : "border-slate-200"
          )}>
            <p className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] font-bold">
              {t('all_rights_reserved')}. © Taghiyev Mahammad
            </p>
          </div>
        </footer>
      </main>
      <Toaster position="top-right" theme={theme === 'dark' ? 'dark' : 'light'} richColors />
    </div>
  );
};

export default Layout;
