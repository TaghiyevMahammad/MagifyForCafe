import React, { useState } from 'react';
import { Trash2, X, Calendar, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { cn, getBakuDateString } from '../lib/utils';

interface ClearHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (startDate: string, startTime: string, endDate: string, endTime: string) => void;
}

const ClearHistoryModal: React.FC<ClearHistoryModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [startDate, setStartDate] = useState(getBakuDateString(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(getBakuDateString(new Date()));
  const [endTime, setEndTime] = useState('23:59');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(startDate, startTime, endDate, endTime);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn(
        "w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border animate-in zoom-in duration-200",
        theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-white border-slate-200"
      )}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>
                {t('clear_history')}
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {t('select_range')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">
                {t('from')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                  theme === 'dark' ? "bg-white/5 border-white/5 focus-within:border-blue-500/50" : "bg-slate-50 border-slate-100 focus-within:border-blue-500/50"
                )}>
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={cn(
                      "bg-transparent text-xs font-bold focus:outline-none w-full",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}
                  />
                </div>
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                  theme === 'dark' ? "bg-white/5 border-white/5 focus-within:border-blue-500/50" : "bg-slate-50 border-slate-100 focus-within:border-blue-500/50"
                )}>
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={cn(
                      "bg-transparent text-xs font-bold focus:outline-none w-full",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">
                {t('to')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                  theme === 'dark' ? "bg-white/5 border-white/5 focus-within:border-blue-500/50" : "bg-slate-50 border-slate-100 focus-within:border-blue-500/50"
                )}>
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={cn(
                      "bg-transparent text-xs font-bold focus:outline-none w-full",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}
                  />
                </div>
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                  theme === 'dark' ? "bg-white/5 border-white/5 focus-within:border-blue-500/50" : "bg-slate-50 border-slate-100 focus-within:border-blue-500/50"
                )}>
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={cn(
                      "bg-transparent text-xs font-bold focus:outline-none w-full",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={cn(
            "p-4 rounded-2xl space-y-2 border",
            theme === 'dark' ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50 border-rose-100"
          )}>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">
              {t('warning')}
            </p>
            <p className={cn("text-xs text-center font-medium leading-relaxed", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>
              {t('clear_history_confirm_range')}
            </p>
          </div>
        </div>

        <div className={cn(
          "p-4 flex gap-3",
          theme === 'dark' ? "bg-white/5" : "bg-slate-50"
        )}>
          <button
            onClick={onClose}
            className={cn(
              "flex-1 py-4 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest",
              theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20"
          >
            {t('clear')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearHistoryModal;
