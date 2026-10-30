import React, { useState, useEffect, useRef } from 'react';
import { X, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface ChangeReportPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangeReportPasswordModal: React.FC<ChangeReportPasswordModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [form, setForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setForm({ current: '', new: '', confirm: '' });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (form.new !== form.confirm) {
      toast.error(t('passwords_dont_match'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/settings/report-password/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.current,
          newPassword: form.new
        })
      });

      if (res.ok) {
        toast.success(t('password_changed_success'));
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.message || t('error_update'));
      }
    } catch (err) {
      toast.error(t('error_update'));
    } finally {
      setLoading(false);
    }
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
            "w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border transition-colors",
            theme === 'dark' ? "bg-[#121212] border-white/10" : "bg-white border-slate-200"
          )}
        >
          <div className={cn(
            "p-6 border-b flex justify-between items-center transition-colors",
            theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                theme === 'dark' ? "bg-emerald-600/20" : "bg-emerald-600/10"
              )}>
                <KeyRound className="w-5 h-5 text-emerald-500" />
              </div>
              <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('change_password')}</h2>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {t('current_report_password')}
                </label>
                <input
                  ref={inputRef}
                  type="password"
                  required
                  value={form.current}
                  onChange={(e) => setForm({ ...form, current: e.target.value })}
                  className={cn(
                    "w-full border rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 transition-all font-medium",
                    theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {t('new_report_password')}
                </label>
                <input
                  type="password"
                  required
                  value={form.new}
                  onChange={(e) => setForm({ ...form, new: e.target.value })}
                  className={cn(
                    "w-full border rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 transition-all font-medium",
                    theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {t('confirm_new_report_password')}
                </label>
                <input
                  type="password"
                  required
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className={cn(
                    "w-full border rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 transition-all font-medium",
                    theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex-1 px-6 py-4 rounded-2xl font-bold transition-all",
                  theme === 'dark' ? "text-zinc-400 hover:bg-white/5" : "text-slate-500 hover:bg-slate-100"
                )}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "..." : t('save')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ChangeReportPasswordModal;
