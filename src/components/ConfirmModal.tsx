import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
      <div className={cn(
        "w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border",
        theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-white border-slate-200"
      )}>
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <div className="space-y-1">
            <h3 className={cn(
              "text-xl font-bold tracking-tight",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{title}</h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed px-2">{message}</p>
          </div>
        </div>
        <div className={cn(
          "p-3 flex gap-2",
          theme === 'dark' ? "bg-white/5" : "bg-slate-50"
        )}>
          <button
            onClick={onCancel}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold transition-colors text-sm",
              theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors text-sm"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
