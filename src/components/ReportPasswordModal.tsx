import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useFinancialVisibility } from '../contexts/FinancialVisibilityContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface ReportPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReportPasswordModal: React.FC<ReportPasswordModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { reveal } = useFinancialVisibility();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setPassword('');
      setError(false);
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    
    const success = await reveal(password);
    if (success) {
      onClose();
    } else {
      setError(true);
      toast.error(t('invalid_report_password'));
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn(
            "w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border transition-colors duration-500",
            theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-white border-slate-200"
          )}
        >
          <div className={cn(
            "p-6 border-b flex justify-between items-center transition-colors",
            theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                theme === 'dark' ? "bg-blue-600/20" : "bg-blue-600/10"
              )}>
                <Lock className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className={cn(
                "text-lg font-bold",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>{t('report_password')}</h2>
            </div>
            <button 
              onClick={onClose} 
              className={cn(
                "p-2 rounded-full transition-colors",
                theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200"
              )}
            >
              <X className={cn("w-5 h-5", theme === 'dark' ? "text-zinc-400" : "text-slate-400")} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  className={cn(
                    "w-full border rounded-2xl px-5 py-4 transition-all pr-12 font-bold",
                    theme === 'dark' 
                      ? (error ? 'border-rose-500 bg-rose-500/5' : 'border-white/10 bg-white/5 hover:border-white/20') 
                      : (error ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'),
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                    theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex-1 px-6 py-4 rounded-2xl font-bold transition-all",
                  theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                )}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "..." : t('confirm')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ReportPasswordModal;
