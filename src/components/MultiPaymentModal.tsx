import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Banknote, CreditCard, Layers, Receipt, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, cn } from '../lib/utils';
import { Table, ActiveSession } from '../types';
import FinancialValue from './FinancialValue';

export interface SelectedTableDetail {
  table: Table;
  session: ActiveSession | null;
  productCost: number;
  serviceFee: number;
  total: number;
  finalPayable: number;
  itemCount: number;
  isActive: boolean;
}

interface MultiPaymentModalProps {
  items: SelectedTableDetail[];
  onClose: () => void;
  onConfirm: (
    paymentData: {
      payment_type: 'cash' | 'card' | 'mixed' | 'unpaid';
      cash_amount: number;
      card_amount: number;
    },
    activeItems: SelectedTableDetail[]
  ) => Promise<void>;
}

const MultiPaymentModal: React.FC<MultiPaymentModalProps> = ({ items, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const activeItems = items.filter(i => i.isActive && i.session);
  const totalAmount = activeItems.reduce((acc, i) => acc + i.finalPayable, 0);
  const totalProductCost = activeItems.reduce((acc, i) => acc + i.productCost, 0);
  const totalServiceFee = activeItems.reduce((acc, i) => acc + i.serviceFee, 0);

  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'mixed' | 'unpaid'>('cash');
  const [cashAmount, setCashAmount] = useState<string>(totalAmount.toString());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCashChange = (val: string) => {
    setCashAmount(val);
    const num = parseFloat(val) || 0;
    if (num > totalAmount) {
      setError(t('error_cash_exceeds_total'));
    } else {
      setError(null);
    }
  };

  const handleConfirm = async () => {
    if (activeItems.length === 0) {
      setError(t('no_active_sessions_to_bill'));
      return;
    }

    let cash = 0;
    let card = 0;

    if (paymentType === 'cash') {
      cash = totalAmount;
      card = 0;
    } else if (paymentType === 'card') {
      cash = 0;
      card = totalAmount;
    } else if (paymentType === 'unpaid') {
      cash = 0;
      card = 0;
    } else {
      cash = parseFloat(cashAmount) || 0;
      if (cash > totalAmount) {
        setError(t('error_cash_exceeds_total'));
        return;
      }
      card = totalAmount - cash;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(
        {
          payment_type: paymentType,
          cash_amount: cash,
          card_amount: card
        },
        activeItems
      );
      onClose();
    } catch (err) {
      setError(t('error_update'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedCardAmount = paymentType === 'mixed'
    ? Math.max(0, totalAmount - (parseFloat(cashAmount) || 0))
    : 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={cn(
          "w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border transition-colors duration-200",
          theme === 'dark' ? "bg-[#111114] border-white/15" : "bg-white border-slate-200"
        )}
      >
        <div
          className={cn(
            "p-4 sm:p-6 border-b flex justify-between items-center",
            theme === 'dark' ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className={cn("text-base sm:text-lg font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                {t('close_common_bill')}
              </h2>
              <p className="text-xs text-zinc-400">
                {activeItems.length} {t('active_tables_to_close').toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              "p-2 rounded-full transition-colors cursor-pointer",
              theme === 'dark' ? "hover:bg-white/10 text-zinc-400" : "hover:bg-slate-200 text-slate-400"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          <div className={cn(
            "rounded-2xl border p-4",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
          )}>
            <div className={cn(
              "flex items-center justify-between mb-3 pb-2 border-b",
              theme === 'dark' ? "border-white/10" : "border-slate-200"
            )}>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t('active_tables_to_close')} ({activeItems.length})
              </span>
              <span className="text-xs font-mono font-bold text-emerald-500 tabular-nums">
                {t('common_bill')}: <FinancialValue>{formatCurrency(totalAmount)}</FinancialValue>
              </span>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {activeItems.map(item => (
                <div
                  key={item.table.id}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-xs",
                    theme === 'dark' ? "bg-[#18181b] border-white/5" : "bg-white border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <p className={cn("font-bold text-sm", theme === 'dark' ? "text-zinc-100" : "text-slate-900")}>{item.table.name}</p>
                      <p className="text-[11px] text-zinc-400 tabular-nums">
                        {item.itemCount} {t('items_count')} • {t('order_amount')}: {formatCurrency(item.productCost)}
                        {item.serviceFee > 0 && ` • ${t('service_fee_amount')}: ${formatCurrency(item.serviceFee)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-emerald-500 tabular-nums">
                      <FinancialValue>{formatCurrency(item.finalPayable)}</FinancialValue>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-1">
              {t('total_to_pay')}
            </p>
            <p className={cn(
              "text-4xl sm:text-5xl font-black tracking-tighter font-mono tabular-nums",
              theme === 'dark' ? "text-emerald-400" : "text-emerald-600"
            )}>
              <FinancialValue>{formatCurrency(totalAmount)}</FinancialValue>
            </p>

            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-zinc-400 tabular-nums">
              <span>{t('product_cost_total')}: <FinancialValue>{formatCurrency(totalProductCost)}</FinancialValue></span>
              {totalServiceFee > 0 && (
                <>
                  <span>•</span>
                  <span>{t('service_fee_total')}: <FinancialValue>{formatCurrency(totalServiceFee)}</FinancialValue></span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t('payment_method')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPaymentType('cash');
                  setError(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all cursor-pointer",
                  paymentType === 'cash'
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-500 shadow-sm"
                    : theme === 'dark'
                      ? "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10"
                      : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
                )}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('cash')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('card');
                  setError(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all cursor-pointer",
                  paymentType === 'card'
                    ? "bg-blue-500/15 border-blue-500 text-blue-500 shadow-sm"
                    : theme === 'dark'
                      ? "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10"
                      : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
                )}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('card')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('mixed');
                  setCashAmount((totalAmount / 2).toFixed(2));
                  setError(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all cursor-pointer",
                  paymentType === 'mixed'
                    ? "bg-purple-500/15 border-purple-500 text-purple-500 shadow-sm"
                    : theme === 'dark'
                      ? "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10"
                      : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
                )}
              >
                <Layers className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('mixed')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('unpaid');
                  setError(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all cursor-pointer",
                  paymentType === 'unpaid'
                    ? "bg-rose-500/15 border-rose-500 text-rose-500 shadow-sm"
                    : theme === 'dark'
                      ? "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10"
                      : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
                )}
              >
                <AlertCircle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('unpaid')}</span>
              </button>
            </div>
          </div>

          {paymentType === 'mixed' && (
            <div className={cn(
              "p-4 rounded-2xl border space-y-4 animate-in fade-in duration-150",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
            )}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t('cash_amount')} (₼)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={totalAmount}
                    value={cashAmount}
                    onChange={(e) => handleCashChange(e.target.value)}
                    className={cn(
                      "w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500",
                      theme === 'dark' ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-slate-300 text-slate-900"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t('card_amount')} (₼)
                  </label>
                  <div className={cn(
                    "w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold tabular-nums flex items-center justify-between",
                    theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-300" : "bg-slate-100 border-slate-200 text-slate-700"
                  )}>
                    <span>{formatCurrency(calculatedCardAmount)}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{t('calculated')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "p-4 sm:p-5 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3",
            theme === 'dark' ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50"
          )}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              "px-5 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer text-center",
              theme === 'dark' ? "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300" : "bg-white border-slate-300 hover:bg-slate-100 text-slate-700"
            )}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || activeItems.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>{t('saving')}...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('confirm_batch_checkout')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiPaymentModal;
