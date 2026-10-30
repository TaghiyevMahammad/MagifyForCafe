import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface ActionPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  verifyEndpoint?: string;
}

type ModalStep = 'verify-action' | 'change-password';

const ActionPasswordModal: React.FC<ActionPasswordModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  verifyEndpoint = '/api/settings/action-password/verify'
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [step, setStep] = useState<ModalStep>('verify-action');
  const [password, setPassword] = useState('');
  const [changeForm, setChangeForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('verify-action');
      setPassword('');
      setChangeForm({ current: '', new: '', confirm: '' });
      setError(false);
      setShake(false);
      setShowPassword(false);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'change-password') {
      setTimeout(() => currentInputRef.current?.focus(), 100);
    }
  }, [step]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleVerifyAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiFetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        onConfirm();
        onClose();
      } else {
        setError(true);
        triggerShake();
        setPassword('');
        toast.error(t('login_error'));
      }
    } catch (err) {
      toast.error(t('error_update'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (changeForm.new !== changeForm.confirm) {
      toast.error(t('passwords_dont_match'));
      triggerShake();
      return;
    }
    if (!changeForm.new) {
      toast.error(t('error_update'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/settings/action-password/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentActionPassword: changeForm.current,
          newActionPassword: changeForm.new
        })
      });
      
      if (res.ok) {
        toast.success(t('admin_password_changed'));
        setStep('verify-action');
        setChangeForm({ current: '', new: '', confirm: '' });
      } else {
        const data = await res.json();
        toast.error(data.message || t('error_update'));
        triggerShake();
      }
    } catch (err) {
      toast.error(t('error_update'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border",
          theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-white border-slate-200",
          shake && "animate-shake"
        )}
      >
        <div className={cn(
          "p-4 border-b flex justify-between items-center",
          theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              theme === 'dark' ? "bg-blue-600/20" : "bg-blue-600/10"
            )}>
              {step === 'verify-action' ? <Lock className="w-4 h-4 text-blue-500" /> :
                <KeyRound className="w-4 h-4 text-emerald-500" />}
            </div>
            <h2 className={cn(
              "text-base font-bold",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>
              {step === 'verify-action' ? (title || t('admin_login')) :
                t('change_admin_password')}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-white/10 text-zinc-400" : "hover:bg-slate-200 text-slate-400"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'verify-action' && (
          <form onSubmit={handleVerifyAction} className="p-6 space-y-4">
            <div className="space-y-1.5">
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
                    "w-full border rounded-xl px-4 py-2.5 transition-colors pr-10 font-bold text-sm",
                    theme === 'dark' 
                      ? (error ? 'border-rose-500 bg-rose-500/5' : 'border-white/10 bg-zinc-900 hover:border-white/20') 
                      : (error ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'),
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 transition-colors",
                    theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <p className="text-[10px] text-rose-500 font-bold px-1">
                  {t('login_error')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-bold transition-colors text-xs",
                    theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-colors text-xs disabled:opacity-50"
                >
                  {loading ? "..." : t('confirm')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStep('change-password')}
                className="text-[10px] text-zinc-500 hover:text-blue-500 font-bold uppercase tracking-widest transition-colors text-center py-1"
              >
                {t('change_password')}
              </button>
            </div>
          </form>
        )}

        {step === 'change-password' && (
          <form onSubmit={handleChangePassword} className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">
                  {t('current_password')}
                </label>
                <input
                  ref={currentInputRef}
                  type="password"
                  required
                  value={changeForm.current}
                  onChange={(e) => setChangeForm({ ...changeForm, current: e.target.value })}
                  className={cn(
                    "w-full border rounded-xl px-4 py-2.5 transition-colors font-bold text-sm",
                    theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:border-emerald-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500",
                  )}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">
                  {t('new_password')}
                </label>
                <input
                  type="password"
                  required
                  value={changeForm.new}
                  onChange={(e) => setChangeForm({ ...changeForm, new: e.target.value })}
                  className={cn(
                    "w-full border rounded-xl px-4 py-2.5 transition-colors font-bold text-sm",
                    theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:border-emerald-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500",
                  )}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">
                  {t('confirm_new_admin_password')}
                </label>
                <input
                  type="password"
                  required
                  value={changeForm.confirm}
                  onChange={(e) => setChangeForm({ ...changeForm, confirm: e.target.value })}
                  className={cn(
                    "w-full border rounded-xl px-4 py-2.5 transition-colors font-bold text-sm",
                    theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:border-emerald-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500",
                  )}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setStep('verify-action')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl font-bold transition-colors text-xs",
                  theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors text-xs disabled:opacity-50"
              >
                {loading ? "..." : t('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ActionPasswordModal;

