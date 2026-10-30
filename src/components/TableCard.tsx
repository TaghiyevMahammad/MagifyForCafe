import React, { useMemo } from 'react';
import { UtensilsCrossed, Crown, CheckCircle2, Edit2, Trash2, ShoppingBag, Clock, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useSessions, formatCountdownMs } from '../contexts/SessionContext';
import { Table, ActiveSession } from '../types';
import { cn, formatCurrency } from '../lib/utils';

interface TableCardProps {
  table: Table;
  size?: 'small' | 'medium' | 'large';
  session?: ActiveSession;
  serviceFeePercent?: number;
  isSelected?: boolean;
  onClick: (e?: any) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const TableCard: React.FC<TableCardProps> = React.memo(({ 
  table, 
  size = 'medium', 
  session, 
  serviceFeePercent = 0,
  isSelected = false,
  onClick, 
  onEdit, 
  onDelete
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { now } = useSessions();

  const isKabinet = table.type === 'kabinet';
  const isActive = !!session;
  const Icon = isKabinet ? Crown : UtensilsCrossed;

  const billData = useMemo(() => {
    if (!session) return { payable: 0, itemCount: 0, openedTime: '' };
    const productCost = (session.products || []).reduce((acc, p) => acc + p.price * p.quantity, 0);
    const itemCount = (session.products || []).reduce((acc, p) => acc + p.quantity, 0);
    const serviceFee = Math.round(productCost * (serviceFeePercent / 100) * 100) / 100;
    const usageTotal = productCost + serviceFee;
    const payable = (session.billingMode === 'depozit' && session.depositAmount)
      ? Math.max(usageTotal, session.depositAmount)
      : usageTotal;

    const openedTime = new Date(session.startTime).toLocaleTimeString('az-AZ', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return { payable, itemCount, openedTime };
  }, [session, serviceFeePercent]);

  const isDepositMode = session?.billingMode === 'depozit';
  const hasReminder = !!(session?.reminderEnabled && session?.reminderEndTime);
  const remainingMs = hasReminder ? Math.max(0, session!.reminderEndTime! - now) : 0;
  const isReminderExpired = hasReminder && remainingMs === 0;

  return (
    <div className="relative group">
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "w-full relative overflow-hidden rounded-2xl border transition-all duration-200 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          size === 'small' ? "p-3 sm:p-3.5" : size === 'large' ? "p-6 sm:p-8" : "p-5 sm:p-6",
          isSelected && "ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 scale-[1.01]",
          isActive
            ? isReminderExpired
              ? "bg-amber-500/15 border-amber-500"
              : isDepositMode
                ? "bg-amber-600/10 border-amber-500/40"
                : "bg-blue-600/10 border-blue-500/40"
            : theme === 'dark'
              ? "bg-[#141414] border-white/5 hover:border-white/10 hover:bg-[#1a1a1a]"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
        )}
      >
        <div className={cn("flex justify-between items-start gap-2", size === 'small' ? "mb-2" : "mb-4")}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "rounded-xl transition-colors shrink-0",
              size === 'small' ? "p-1.5 sm:p-2" : size === 'large' ? "p-3 sm:p-4" : "p-2.5 sm:p-3",
              isActive
                ? isDepositMode
                  ? "bg-amber-500/20"
                  : "bg-blue-500/20"
                : theme === 'dark' ? "bg-white/5" : "bg-slate-100"
            )}>
              <Icon className={cn(
                size === 'small' ? "w-4 h-4" : size === 'large' ? "w-6 h-6 sm:w-7 sm:h-7" : "w-5 h-5 sm:w-6 sm:h-6",
                isActive
                  ? isDepositMode
                    ? "text-amber-500"
                    : "text-blue-500"
                  : isKabinet
                    ? (theme === 'dark' ? "text-amber-500/70" : "text-amber-600")
                    : (theme === 'dark' ? "text-zinc-500" : "text-slate-400")
              )} />
            </div>

            {session?.isAlreadyPaid && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 truncate">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{t('already_paid')}</span>
              </span>
            )}
          </div>

          {isActive && (
            <div className="flex items-center gap-1.5 text-right shrink-0">
              {hasReminder && (
                <span className={cn(
                  "inline-flex items-center gap-1 font-mono font-bold tabular-nums",
                  size === 'small' ? "text-[10px]" : "text-xs",
                  isReminderExpired ? "text-amber-500" : (theme === 'dark' ? "text-amber-400" : "text-amber-600")
                )}>
                  <Bell className="w-3 h-3 shrink-0" />
                  <span>{formatCountdownMs(remainingMs)}</span>
                  <span aria-hidden="true" className="text-zinc-500">·</span>
                </span>
              )}
              <span className={cn(
                "font-semibold",
                size === 'small' ? "text-[10px]" : "text-xs",
                isDepositMode ? "text-amber-500" : "text-blue-500"
              )}>
                {isDepositMode ? t('depozit') : t('active')}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-0.5 overflow-hidden">
          <h3 className={cn(
            "font-bold truncate",
            size === 'small' ? "text-xs sm:text-sm" : size === 'large' ? "text-lg sm:text-xl" : "text-base sm:text-lg",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>{table.name}</h3>
          {size !== 'small' && (
            <p className={cn(
              "text-[10px] sm:text-xs truncate",
              theme === 'dark' ? "text-zinc-500" : "text-slate-500"
            )}>
              {session?.guestNote ? session.guestNote : (isKabinet ? t('vip_kabinet') : t('standard'))}
            </p>
          )}
        </div>

        {isActive ? (
          <div className={cn("flex items-end justify-between gap-2", size === 'small' ? "mt-3" : "mt-5 sm:mt-6")}>
            <div className="space-y-0.5 min-w-0">
              {size !== 'small' && (
                <p className={cn(
                  "text-xs font-medium",
                  theme === 'dark' ? "text-zinc-500" : "text-slate-500"
                )}>
                  {t('current_amount')}
                </p>
              )}
              <p className={cn(
                "font-mono font-bold tracking-tighter tabular-nums",
                size === 'small' ? "text-base sm:text-lg" : size === 'large' ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>
                {formatCurrency(billData.payable)}
              </p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <div className={cn(
                "inline-flex items-center gap-1 font-bold tabular-nums",
                size === 'small' ? "text-[10px]" : "text-xs",
                isDepositMode ? "text-amber-500" : "text-blue-500"
              )}>
                <ShoppingBag className={cn(size === 'small' ? "w-2.5 h-2.5" : "w-3.5 h-3.5")} />
                <span>{billData.itemCount} {t('items_count')}</span>
              </div>
              {size !== 'small' && (
                <p className={cn(
                  "text-[11px] font-medium flex items-center justify-end gap-1 tabular-nums",
                  theme === 'dark' ? "text-zinc-500" : "text-slate-500"
                )}>
                  <Clock className="w-2.5 h-2.5" />
                  <span>{billData.openedTime}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className={cn("flex items-center gap-1.5 text-emerald-500", size === 'small' ? "mt-3" : "mt-5 sm:mt-6")}>
            <CheckCircle2 className={cn(size === 'small' ? "w-3.5 h-3.5" : "w-3.5 h-3.5 sm:w-4 sm:h-4")} />
            <span className={cn("font-semibold", size === 'small' ? "text-[10px]" : "text-xs")}>{t('available')}</span>
          </div>
        )}
      </div>

      <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 flex gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 z-10 transition-opacity">
        {!isActive && (
          <>
            <button
              onClick={onEdit}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer",
                theme === 'dark'
                  ? "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/5"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 border-slate-200"
              )}
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={onDelete}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer",
                theme === 'dark'
                  ? "bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-500 border-white/5"
                  : "bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200"
              )}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default TableCard;
