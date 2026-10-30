import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const from = (location.state as any)?.from || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(false);

    const success = await login(password);
    if (success) {
      toast.success(t('success_update'));
      navigate(from, { replace: true });
    } else {
      setError(true);
      toast.error(t('login_error'));
    }
    setIsSubmitting(false);
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-6 font-sans transition-colors duration-200",
      theme === 'dark' ? "bg-[#050505]" : "bg-slate-50"
    )}>
      <div className="w-full max-w-[440px] relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <img 
            src={theme === 'dark' ? "/logo.png" : "/logo1.png"} 
            alt="Magify Logo" 
            className="w-20 h-auto object-contain mb-4"
            referrerPolicy="no-referrer"
          />
          <p className="text-zinc-500 text-sm font-medium">
            {t('admin_login')}
          </p>
        </div>

        <div className={cn(
          "border rounded-2xl p-8 shadow-xl transition-colors duration-200",
          theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.08]" : "bg-white border-slate-200"
        )}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-zinc-400 text-sm">{t('admin_password_prompt')}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    {t('password')}
                  </label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-zinc-500" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors duration-150 placeholder:text-zinc-700",
                      theme === 'dark' 
                        ? `bg-white/[0.03] ${error ? 'border-rose-500/40' : 'border-white/[0.08]'} text-white focus:border-blue-500/40` 
                        : `bg-slate-50 ${error ? 'border-rose-500/40' : 'border-slate-200'} text-slate-900 focus:border-blue-500/40`
                    )}
                    placeholder={t('enter_password')}
                    autoFocus
                    required
                  />
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 text-rose-500 text-[11px] font-medium mt-3 ml-1 animate-shake">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('login_error')}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full font-bold py-4 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2",
                theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
              )}
            >
              {isSubmitting ? (
                <div className={cn(
                  "w-5 h-5 border-2 rounded-full animate-spin",
                  theme === 'dark' ? "border-black/20 border-t-black" : "border-white/20 border-t-white"
                )} />
              ) : (
                <>
                  <span>{t('sign_in')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-12 text-center">
          <p className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] font-bold">
            {t('all_rights_reserved')}. © Taghiyev Mahammad
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
