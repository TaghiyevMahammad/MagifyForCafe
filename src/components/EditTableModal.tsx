import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Table } from '../types';
import { apiFetch } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface EditTableModalProps {
  table: Table;
  onClose: () => void;
  onSuccess: () => void;
}

const EditTableModal: React.FC<EditTableModalProps> = ({ table, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [name, setName] = useState(table.name);
  const [type, setType] = useState<'kabinet' | 'table'>(table.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type })
      });
      if (res.ok) {
        toast.success(t('success_update'));
        onSuccess();
        onClose();
      } else {
        toast.error(t('error_update'));
      }
    } catch (error) {
      toast.error(t('error_update'));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
      <div className={cn(
        "w-full max-w-md rounded-2xl overflow-hidden shadow-xl border transition-colors duration-200",
        theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-white border-slate-200"
      )}>
        <div className={cn(
          "p-6 border-b flex justify-between items-center transition-colors",
          theme === 'dark' ? "border-white/5" : "border-slate-100 bg-slate-50/50"
        )}>
          <h2 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('edit_table')}</h2>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-full transition-colors duration-150",
              theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200"
            )}
          >
            <X className={cn("w-5 h-5", theme === 'dark' ? "text-zinc-400" : "text-slate-400")} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('name')}</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className={cn(
                "w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors duration-150 font-medium",
                theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
              placeholder={t('table_name_placeholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('type')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('table')}
                className={cn(
                  "py-3 rounded-xl border font-bold transition-colors duration-150",
                  type === 'table'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : (theme === 'dark' ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                )}
              >
                {t('standard')}
              </button>
              <button
                type="button"
                onClick={() => setType('kabinet')}
                className={cn(
                  "py-3 rounded-xl border font-bold transition-colors duration-150",
                  type === 'kabinet'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : (theme === 'dark' ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                )}
              >
                {t('vip_kabinet')}
              </button>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold transition-colors duration-150",
                theme === 'dark' ? "text-zinc-400 hover:bg-white/5" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-colors duration-150"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTableModal;
