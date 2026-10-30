import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Package, 
  BarChart3, 
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  Warehouse,
  TrendingUp,
  Moon,
  Sun,
  Shield,
  Calendar,
  BookOpen
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiFetch } from '../lib/api';
import ConfirmModal from './ConfirmModal';
import ActionPasswordModal from './ActionPasswordModal';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { t, i18n } = useTranslation();
  const { logout, isAdminMode, setAdminMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard'), adminOnly: true },
    { to: '/tables', icon: UtensilsCrossed, label: t('tables') },
    { to: '/reservations', icon: Calendar, label: t('reservations') },
    { to: '/products', icon: Package, label: t('products') },
    { to: '/inventory', icon: Warehouse, label: t('inventory') },
    { to: '/inventory-profit', icon: TrendingUp, label: t('inventory_profit'), adminOnly: true },
    { to: '/reports', icon: BarChart3, label: t('reports'), adminOnly: true },
    { to: '/daily-notes', icon: BookOpen, label: t('daily_notes') },
    { to: '/settings', icon: SettingsIcon, label: t('settings') },
  ];

  const filteredItems = navItems.filter(item => !item.adminOnly || isAdminMode);

  const toggleLanguage = () => {
    const langs = ['az', 'en', 'ru'];
    const next = langs[(langs.indexOf(i18n.language) + 1) % langs.length];
    i18n.changeLanguage(next);
    apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { language: next } })
    });
  };

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full transition-[width] duration-300 z-50 flex flex-col",
        theme === 'dark' ? "bg-[#0A0A0A] border-r border-white/[0.05]" : "bg-white border-r border-slate-200",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img 
              src={theme === 'dark' ? "/logo.png" : "/logo1.png"} 
              alt="Magify Logo" 
              className="w-10 h-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <img 
              src={theme === 'dark' ? "/logo.png" : "/logo1.png"} 
              alt="Magify Logo" 
              className="w-8 h-8 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center gap-4 px-4 py-3 rounded-xl transition-colors duration-150 group relative",
              isActive 
                ? (theme === 'dark' ? "bg-white/[0.05] text-white" : "bg-blue-50 text-blue-600 border border-blue-100/50") 
                : (theme === 'dark' ? "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50")
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div 
                    className={cn(
                      "absolute left-0 w-1 h-5 rounded-r-full",
                      theme === 'dark' ? "bg-white" : "bg-blue-600"
                    )}
                  />
                )}
                <item.icon className={cn("w-5 h-5", collapsed && "mx-auto")} />
                {!collapsed && <span className="font-semibold text-xs tracking-tight">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn(
        "p-4 space-y-1 border-t",
        theme === 'dark' ? "border-white/[0.05]" : "border-slate-100"
      )}>
        <button 
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors duration-150 group",
            theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/[0.02]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          {theme === 'dark' ? (
            <Sun className={cn("w-5 h-5", collapsed && "mx-auto")} />
          ) : (
            <Moon className={cn("w-5 h-5", collapsed && "mx-auto")} />
          )}
          {!collapsed && <span className="font-semibold text-xs tracking-tight">{theme === 'dark' ? t('light_mode') : t('dark_mode')}</span>}
        </button>

        <button 
          onClick={toggleLanguage}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors duration-150 group",
            theme === 'dark' ? "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Globe className={cn("w-5 h-5", collapsed && "mx-auto")} />
          {!collapsed && <span className="font-semibold text-xs uppercase tracking-wider">{i18n.language}</span>}
        </button>

        <button 
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/[0.05] transition-colors duration-150 group"
        >
          <LogOut className={cn("w-5 h-5", collapsed && "mx-auto")} />
          {!collapsed && <span className="font-semibold text-xs">{t('logout')}</span>}
        </button>

        {!isAdminMode && (
          <button 
            onClick={() => setIsAdminModalOpen(true)}
            className={cn(
              "w-full flex items-center justify-center p-2 rounded-xl transition-all duration-300 opacity-20 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5",
              theme === 'dark' ? "text-white" : "text-black"
            )}
            title="Admin Mode"
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center justify-center p-3 rounded-xl transition-colors mt-2",
            theme === 'dark' ? "hover:bg-white/[0.05] text-zinc-600 hover:text-zinc-400" : "hover:bg-slate-50 text-slate-400 hover:text-slate-600"
          )}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title={t('logout_confirm_title')}
        message={t('logout_confirm_message')}
        onConfirm={logout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      <ActionPasswordModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onConfirm={() => setAdminMode(true)}
        title={t('admin_login')}
        verifyEndpoint="/api/settings/report-password/verify"
      />
    </aside>
  );
};

export default Sidebar;
